import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { todayISO } from "@tributoleao/shared";
import { buildApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createSession, isoDay, resetDb, validSupplier } from "./helpers";

let app: FastifyInstance;
let cookies: Record<string, string>;
let supplierId: string;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  ({ cookies } = await createSession(app));
  supplierId = (await app.inject({ method: "POST", url: "/suppliers", cookies, payload: validSupplier })).json().id;
});

async function tax(amountCents: number, dueDate: string, { paid = false, name = "DARF" } = {}) {
  const { id } = (
    await app.inject({
      method: "POST",
      url: "/taxes",
      cookies,
      payload: { name, amountCents, dueDate, referenceMonth: dueDate.slice(0, 7), paymentCode: `PIX-${name}` },
    })
  ).json();
  if (paid) await app.inject({ method: "PATCH", url: `/taxes/${id}/pay`, cookies, payload: { paidAt: dueDate } });
  return id as string;
}

async function boleto(amountCents: number, dueDate: string, { paid = false, feesCents = 0, description = "Boleto" } = {}) {
  const { id } = (
    await app.inject({
      method: "POST",
      url: "/boletos",
      cookies,
      payload: { supplierId, description, amountCents, feesCents, issueDate: "2020-01-01", dueDate, barcode: `BAR-${description}` },
    })
  ).json();
  if (paid) await app.inject({ method: "PATCH", url: `/boletos/${id}/pay`, cookies, payload: { paidAt: dueDate } });
  return id as string;
}

const stats = async (query = "") => {
  const res = await app.inject({ method: "GET", url: `/dashboard/stats${query}`, cookies });
  expect(res.statusCode).toBe(200);
  return res.json();
};

describe("GET /dashboard/stats", () => {
  it("exige sessão e valida o mês", async () => {
    expect((await app.inject({ method: "GET", url: "/dashboard/stats" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/dashboard/stats?month=2030-13", cookies })).statusCode).toBe(400);
  });

  it("usa o mês atual por padrão e retorna zeros sem dados de outros usuários", async () => {
    const other = await createSession(app, "outro@exemplo.com");
    await app.inject({
      method: "POST",
      url: "/taxes",
      cookies: other.cookies,
      payload: { name: "DAS", amountCents: 50000, dueDate: isoDay(-1), referenceMonth: "2026-09" },
    });

    const body = await stats();
    expect(body.month).toBe(todayISO().slice(0, 7));
    expect(body.monthTotals).toEqual({ totalCents: 0, paidCents: 0, pendingCents: 0 });
    expect(body.overdue).toEqual({ count: 0, totalCents: 0 });
    expect(body.pendingBoletos).toEqual({ count: 0, totalCents: 0, overdueCount: 0 });
    expect(body.nextDue).toBeNull();
    expect(body.agenda).toEqual([]);
    expect(body.distribution).toEqual({ taxesCents: 0, boletosCents: 0, taxesPercent: 0, boletosPercent: 0 });
  });

  it("calcula totais do mês, acumulado anual de impostos e distribuição", async () => {
    // Mês de referência: janeiro/2030
    await tax(1000, "2030-01-10");
    await tax(2000, "2030-01-15", { paid: true });
    await boleto(3000, "2030-01-20", { feesCents: 100 });
    await boleto(500, "2030-01-05", { paid: true });
    // Fora do mês: entram só no acumulado anual (fev/2030) ou em nada (dez/2029)
    await tax(9999, "2030-02-10");
    await tax(7777, "2029-12-10");

    const body = await stats("?month=2030-01");

    expect(body.month).toBe("2030-01");
    expect(body.monthTotals).toEqual({ totalCents: 6600, paidCents: 2500, pendingCents: 4100 });
    expect(body.taxesYearToDate).toEqual({ year: 2030, totalCents: 12999, paidCents: 2000, pendingCents: 10999 });
    expect(body.distribution).toEqual({ taxesCents: 3000, boletosCents: 3600, taxesPercent: 45.5, boletosPercent: 54.5 });
  });

  it("monta atrasados, boletos pendentes, próximo vencimento e agenda relativos a hoje", async () => {
    await tax(10000, isoDay(-5), { name: "DAS" }); // atrasado
    await boleto(2000, isoDay(-2), { feesCents: 150, description: "Internet" }); // atrasado
    await boleto(4000, isoDay(3), { description: "Aluguel" }); // próximo vencimento
    await tax(8000, isoDay(20), { name: "IPTU" }); // fora da janela de 15 dias
    await boleto(9000, isoDay(-1), { paid: true, description: "Pago" }); // pago: ignorado

    const body = await stats();

    expect(body.overdue).toEqual({ count: 2, totalCents: 12150 });
    expect(body.pendingBoletos).toEqual({ count: 2, totalCents: 6150, overdueCount: 1 });

    expect(body.nextDue).toMatchObject({
      type: "BOLETO",
      title: "Aluguel",
      subtitle: validSupplier.tradeName,
      amountCents: 4000,
      daysUntilDue: 3,
      status: "PENDENTE",
      paymentCode: "BAR-Aluguel",
    });

    expect(body.agenda.map((i: { title: string; status: string; daysUntilDue: number }) => [i.title, i.status, i.daysUntilDue])).toEqual([
      ["DAS", "ATRASADO", -5],
      ["Internet", "ATRASADO", -2],
      ["Aluguel", "PENDENTE", 3],
    ]);
    expect(body.agenda[1]).toMatchObject({ type: "BOLETO", amountCents: 2150, paymentCode: "BAR-Internet" });
  });

  it("considera como próximo vencimento um item que vence hoje", async () => {
    await tax(500, todayISO(), { name: "ISS" });
    await boleto(700, isoDay(1));

    const body = await stats();
    expect(body.nextDue).toMatchObject({ type: "TAX", title: "ISS", daysUntilDue: 0, status: "PENDENTE" });
  });
});
