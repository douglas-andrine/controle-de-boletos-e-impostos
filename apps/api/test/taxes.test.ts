import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { todayISO } from "@tributoleao/shared";
import { buildApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createSession, isoDay, resetDb } from "./helpers";

let app: FastifyInstance;
let cookies: Record<string, string>;

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
});

const baseTax = { name: "DARF", revenueCode: "0561", amountCents: 98750, referenceMonth: "2026-09", dueDate: isoDay(10) };

const createTax = (overrides: object = {}) =>
  app.inject({ method: "POST", url: "/taxes", cookies, payload: { ...baseTax, ...overrides } });

const list = async (query: string) => (await app.inject({ method: "GET", url: `/taxes?${query}`, cookies })).json();

describe("Impostos", () => {
  it("cria e serializa datas, período e status", async () => {
    const res = await createTax();
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: "DARF",
      amountCents: 98750,
      dueDate: baseTax.dueDate,
      referenceMonth: "2026-09",
      status: "PENDENTE",
      paidAt: null,
      paymentCode: null,
      hasReceipt: false,
    });
  });

  it("valida valor positivo, data e período", async () => {
    const res = await createTax({ amountCents: 0, dueDate: "31/12/2026", referenceMonth: "2026-13" });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().issues)).toEqual(expect.arrayContaining(["amountCents", "dueDate", "referenceMonth"]));
  });

  it("marca como ATRASADO o pendente vencido e filtra por status efetivo", async () => {
    await createTax({ name: "DAS", dueDate: isoDay(-3) }); // atrasado
    await createTax({ name: "ISS", dueDate: todayISO() }); // vence hoje: ainda pendente
    const paid = (await createTax({ name: "FGTS", dueDate: isoDay(-10) })).json();
    await app.inject({ method: "PATCH", url: `/taxes/${paid.id}/pay`, cookies });

    const names = (body: { data: { name: string }[] }) => body.data.map((t) => t.name);

    expect(names(await list("status=ATRASADO"))).toEqual(["DAS"]);
    expect(names(await list("status=PENDENTE"))).toEqual(["ISS"]);
    expect(names(await list("status=PAGO"))).toEqual(["FGTS"]);
    // Sem filtro: todos, ordenados por vencimento
    expect(names(await list(""))).toEqual(["FGTS", "DAS", "ISS"]);
    expect((await list("status=ATRASADO")).data[0].status).toBe("ATRASADO");
  });

  it("filtra por período de apuração, intervalo de vencimento e busca", async () => {
    await createTax({ name: "DAS", referenceMonth: "2026-08", dueDate: "2026-09-20" });
    await createTax({ name: "DARF", referenceMonth: "2026-09", dueDate: "2026-10-20" });
    await createTax({ name: "IPTU", referenceMonth: "2026-09", dueDate: "2026-11-10" });

    expect((await list("referenceMonth=2026-09")).meta.total).toBe(2);
    expect((await list("dueFrom=2026-10-01&dueTo=2026-10-31")).data.map((t: { name: string }) => t.name)).toEqual(["DARF"]);
    expect((await list("search=iptu")).data).toHaveLength(1);
  });

  it("dá baixa com a data de hoje, impede baixa dupla e permite estorno", async () => {
    const { id } = (await createTax()).json();

    const pay = await app.inject({ method: "PATCH", url: `/taxes/${id}/pay`, cookies });
    expect(pay.statusCode).toBe(200);
    expect(pay.json()).toMatchObject({ status: "PAGO", paidAt: todayISO() });

    const again = await app.inject({ method: "PATCH", url: `/taxes/${id}/pay`, cookies });
    expect(again.statusCode).toBe(409);

    const unpay = await app.inject({ method: "PATCH", url: `/taxes/${id}/unpay`, cookies });
    expect(unpay.json()).toMatchObject({ status: "PENDENTE", paidAt: null });
  });

  it("aceita data de pagamento informada", async () => {
    const { id } = (await createTax()).json();
    const pay = await app.inject({ method: "PATCH", url: `/taxes/${id}/pay`, cookies, payload: { paidAt: "2026-10-01" } });
    expect(pay.json().paidAt).toBe("2026-10-01");
  });

  it("atualiza e exclui", async () => {
    const { id } = (await createTax()).json();

    const put = await app.inject({ method: "PUT", url: `/taxes/${id}`, cookies, payload: { ...baseTax, amountCents: 100000 } });
    expect(put.json()).toMatchObject({ amountCents: 100000, revenueCode: "0561" });

    expect((await app.inject({ method: "DELETE", url: `/taxes/${id}`, cookies })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/taxes/${id}`, cookies })).statusCode).toBe(404);
  });

  it("isola os impostos por usuário", async () => {
    const { id } = (await createTax()).json();
    const intruder = await createSession(app, "intruso@exemplo.com");

    const responses = await Promise.all([
      app.inject({ method: "GET", url: `/taxes/${id}`, cookies: intruder.cookies }),
      app.inject({ method: "PUT", url: `/taxes/${id}`, cookies: intruder.cookies, payload: baseTax }),
      app.inject({ method: "PATCH", url: `/taxes/${id}/pay`, cookies: intruder.cookies }),
      app.inject({ method: "DELETE", url: `/taxes/${id}`, cookies: intruder.cookies }),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([404, 404, 404, 404]);

    const own = await app.inject({ method: "GET", url: `/taxes/${id}`, cookies });
    expect(own.json().status).toBe("PENDENTE");
  });
});
