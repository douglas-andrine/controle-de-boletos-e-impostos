import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
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

const createBoleto = async (dueDate: string, amountCents: number, feesCents = 0) =>
  (await app.inject({ method: "POST", url: "/boletos", cookies, payload: { supplierId, dueDate, amountCents, feesCents } })).json().id as string;

const createTax = async (dueDate: string, amountCents: number, invoiceNumber?: string) =>
  (
    await app.inject({
      method: "POST",
      url: "/taxes",
      cookies,
      payload: { name: "DARF", amountCents, referenceMonth: dueDate.slice(0, 7), dueDate, invoiceNumber },
    })
  ).json().id as string;

const pay = (kind: "boletos" | "taxes", id: string) => app.inject({ method: "PATCH", url: `/${kind}/${id}/pay`, cookies });

const report = (kind: "boletos" | "taxes", query: string, as = cookies) => app.inject({ method: "GET", url: `/reports/${kind}?${query}`, cookies: as });

// Datas no meio do mês atual, para os testes de "mês" não dependerem do dia em que rodam
const month = isoDay(0).slice(0, 7);
const inMonth = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
const nextMonth = () => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10);
};

describe("Relatórios", () => {
  it("diário de boletos traz só os que vencem no dia, com juros no total", async () => {
    await createBoleto(inMonth(10), 10000, 500);
    await createBoleto(inMonth(10), 20000);
    await createBoleto(inMonth(11), 99900);

    const res = await report("boletos", `day=${inMonth(10)}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ from: inMonth(10), to: inMonth(10), totals: { count: 2, totalCents: 30500 } });
    expect(body.items.map((b: { totalCents: number }) => b.totalCents)).toEqual([10500, 20000]);
  });

  it("mensal de boletos traz o mês inteiro, sem limite de página", async () => {
    for (let i = 0; i < 105; i++) await createBoleto(inMonth(1 + (i % 28)), 100);
    await createBoleto(nextMonth(), 5000);

    const body = (await report("boletos", `month=${month}`)).json();
    expect(body.from).toBe(`${month}-01`);
    expect(body.items).toHaveLength(105);
    expect(body.totals).toMatchObject({ count: 105, totalCents: 10500 });
  });

  it("separa pago, pendente e atrasado nos totais e aceita filtro por status", async () => {
    const paidId = await createBoleto(isoDay(0), 1000);
    await pay("boletos", paidId);
    await createBoleto(isoDay(0), 2000);
    const days = [isoDay(0), isoDay(-1)];
    const sameMonth = days.every((d) => d.slice(0, 7) === month);
    if (sameMonth) await createBoleto(isoDay(-1), 4000);

    const all = (await report("boletos", `month=${month}`)).json();
    expect(all.totals).toMatchObject({
      paidCents: 1000,
      pendingCents: sameMonth ? 6000 : 2000,
      overdueCents: sameMonth ? 4000 : 0,
    });

    const onlyPaid = (await report("boletos", `month=${month}&status=PAGO`)).json();
    expect(onlyPaid.items).toHaveLength(1);
    expect(onlyPaid.totals).toMatchObject({ count: 1, totalCents: 1000, paidCents: 1000, pendingCents: 0 });
  });

  it("diário e mensal de impostos", async () => {
    await createTax(inMonth(5), 30000, "1");
    await createTax(inMonth(5), 12000, "2");
    await createTax(inMonth(20), 8000, "3");
    await createTax(nextMonth(), 50000, "4");

    const day = (await report("taxes", `day=${inMonth(5)}`)).json();
    expect(day.totals).toMatchObject({ count: 2, totalCents: 42000 });
    expect(day.items[0]).toMatchObject({ name: "DARF", dueDate: inMonth(5) });

    const monthly = (await report("taxes", `month=${month}`)).json();
    expect(monthly.totals).toMatchObject({ count: 3, totalCents: 50000 });
  });

  it("não mostra dados de outro usuário", async () => {
    await createBoleto(inMonth(10), 10000);
    await createTax(inMonth(10), 10000);
    const intruder = await createSession(app, "outro@exemplo.com");

    for (const kind of ["boletos", "taxes"] as const) {
      const body = (await report(kind, `month=${month}`, intruder.cookies)).json();
      expect(body.items).toEqual([]);
      expect(body.totals.totalCents).toBe(0);
    }
  });

  it("exige o dia ou o mês, mas não os dois", async () => {
    expect((await report("boletos", "")).statusCode).toBe(400);
    expect((await report("taxes", `day=${inMonth(1)}&month=${month}`)).statusCode).toBe(400);
    expect((await report("boletos", "month=2026-13")).statusCode).toBe(400);
  });

  it("exige sessão", async () => {
    expect((await app.inject({ method: "GET", url: `/reports/boletos?month=${month}` })).statusCode).toBe(401);
  });
});
