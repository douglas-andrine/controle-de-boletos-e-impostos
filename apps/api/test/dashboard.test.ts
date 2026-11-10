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
      payload: { supplierId, invoiceNumber: description, description, amountCents, feesCents, issueDate: "2020-01-01", dueDate, barcode: `BAR-${description}` },
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
    expect(body.lateDeliveries).toEqual({ count: 0 });
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

  it("monta a série mensal do ano e os fornecedores com mais valor no mês", async () => {
    await tax(1000, "2030-01-10");
    await boleto(3000, "2030-01-20", { feesCents: 100 });
    await boleto(500, "2030-03-05");
    await tax(7777, "2029-12-10"); // outro ano

    const other = (await app.inject({ method: "POST", url: "/suppliers", cookies, payload: { tradeName: "Papelaria" } })).json().id;
    await app.inject({
      method: "POST",
      url: "/taxes",
      cookies,
      payload: { name: "ICMS", amountCents: 9000, dueDate: "2030-01-12", referenceMonth: "2030-01", supplierId: other },
    });

    const body = await stats("?month=2030-01");
    expect(body.yearByMonth).toHaveLength(12);
    expect(body.yearByMonth[0]).toEqual({ month: "2030-01", taxesCents: 10000, boletosCents: 3100 });
    expect(body.yearByMonth[1]).toEqual({ month: "2030-02", taxesCents: 0, boletosCents: 0 });
    expect(body.yearByMonth[2]).toEqual({ month: "2030-03", taxesCents: 0, boletosCents: 500 });
    // Imposto sem fornecedor (o DARF) fica de fora; o ICMS conta para a Papelaria
    expect(body.topSuppliers).toEqual([
      { id: other, name: "Papelaria", totalCents: 9000, count: 1 },
      { id: supplierId, name: validSupplier.tradeName, totalCents: 3100, count: 1 },
    ]);
  });

  it("separa o que já venceu dentro do mês", async () => {
    // Mês passado: todo pendente já venceu; o pago não conta
    await tax(1000, "2020-01-10");
    await boleto(2000, "2020-01-20", { feesCents: 50 });
    await boleto(4000, "2020-01-05", { paid: true });
    // Mês futuro: nada venceu ainda
    await tax(3000, "2099-01-10");

    expect((await stats("?month=2020-01")).monthOverdue).toEqual({ count: 2, totalCents: 3050 });
    expect((await stats("?month=2099-01")).monthOverdue).toEqual({ count: 0, totalCents: 0 });
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
      title: validSupplier.tradeName, // boleto: fornecedor no título e a nota abaixo
      subtitle: "NF Aluguel",
      amountCents: 4000,
      daysUntilDue: 3,
      status: "PENDENTE",
      paymentCode: "BAR-Aluguel",
    });

    expect(body.agenda.map((i: { title: string; status: string; daysUntilDue: number }) => [i.title, i.status, i.daysUntilDue])).toEqual([
      ["DAS", "ATRASADO", -5],
      [validSupplier.tradeName, "ATRASADO", -2],
      [validSupplier.tradeName, "PENDENTE", 3],
    ]);
    expect(body.agenda[1]).toMatchObject({ type: "BOLETO", subtitle: "NF Internet", amountCents: 2150, paymentCode: "BAR-Internet" });
  });

  it("considera como próximo vencimento um item que vence hoje", async () => {
    await tax(500, todayISO(), { name: "ISS" });
    await boleto(700, isoDay(1));

    const body = await stats();
    expect(body.nextDue).toMatchObject({ type: "TAX", title: "ISS", daysUntilDue: 0, status: "PENDENTE" });
  });

  it("conta as mercadorias com entrega atrasada", async () => {
    const create = async (goodsDelivered: boolean, paidDaysAgo: number) => {
      const payload = { name: "ICMS", amountCents: 1000, dueDate: isoDay(-paidDaysAgo), referenceMonth: isoDay(-paidDaysAgo).slice(0, 7), goodsDelivered };
      const { id } = (await app.inject({ method: "POST", url: "/taxes", cookies, payload })).json();
      await app.inject({ method: "PATCH", url: `/taxes/${id}/pay`, cookies, payload: { paidAt: isoDay(-paidDaysAgo) } });
    };
    await create(false, 16); // atrasada
    await create(false, 15); // vence hoje
    await create(true, 30); // entregue

    const body = (await app.inject({ method: "GET", url: "/dashboard/stats", cookies })).json();
    expect(body.lateDeliveries).toEqual({ count: 1 });
  });
});
