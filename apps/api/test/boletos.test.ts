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

const baseBoleto = () => ({
  supplierId,
  description: "Conta de energia",
  amountCents: 48790,
  feesCents: 1210,
  issueDate: isoDay(-10),
  dueDate: isoDay(5),
  barcode: "34191790010104351004791020150008291070026000",
});

const createBoleto = (overrides: object = {}) =>
  app.inject({ method: "POST", url: "/boletos", cookies, payload: { ...baseBoleto(), ...overrides } });

describe("Boletos", () => {
  it("cria com total (valor + juros) e dados do fornecedor", async () => {
    const res = await createBoleto();
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      description: "Conta de energia",
      amountCents: 48790,
      feesCents: 1210,
      totalCents: 50000,
      status: "PENDENTE",
      supplier: { id: supplierId, legalName: validSupplier.legalName, tradeName: validSupplier.tradeName },
    });
  });

  it("assume juros zero quando não informado", async () => {
    const { feesCents: _, ...withoutFees } = baseBoleto();
    const res = await app.inject({ method: "POST", url: "/boletos", cookies, payload: withoutFees });
    expect(res.json()).toMatchObject({ feesCents: 0, totalCents: 48790 });
  });

  it("rejeita vencimento anterior à emissão", async () => {
    const res = await createBoleto({ issueDate: isoDay(0), dueDate: isoDay(-1) });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.dueDate).toEqual(["O vencimento não pode ser anterior à emissão"]);
  });

  it("não permite usar fornecedor de outro usuário", async () => {
    const other = await createSession(app, "outro@exemplo.com");
    const res = await app.inject({ method: "POST", url: "/boletos", cookies: other.cookies, payload: baseBoleto() });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Fornecedor não encontrado");
  });

  it("filtra por fornecedor, status, intervalo de vencimento e busca", async () => {
    const otherSupplier = (
      await app.inject({
        method: "POST",
        url: "/suppliers",
        cookies,
        payload: { legalName: "Conecta Telecom Ltda.", document: "45723174000110" },
      })
    ).json().id;

    await createBoleto({ description: "Energia atrasada", issueDate: isoDay(-30), dueDate: isoDay(-2) });
    await createBoleto({ description: "Energia do mês", dueDate: isoDay(5) });
    await createBoleto({ supplierId: otherSupplier, description: "Internet", dueDate: isoDay(40) });

    const get = async (query: string) =>
      (await app.inject({ method: "GET", url: `/boletos?${query}`, cookies })).json().data.map((b: { description: string }) => b.description);

    expect(await get(`supplierId=${otherSupplier}`)).toEqual(["Internet"]);
    expect(await get("status=ATRASADO")).toEqual(["Energia atrasada"]);
    expect(await get(`dueFrom=${isoDay(0)}&dueTo=${isoDay(30)}`)).toEqual(["Energia do mês"]);
    expect(await get("search=conecta")).toEqual(["Internet"]); // busca pelo nome do fornecedor
  });

  it("registra pagamento, impede pagamento duplicado e estorna", async () => {
    const { id } = (await createBoleto()).json();

    const pay = await app.inject({ method: "PATCH", url: `/boletos/${id}/pay`, cookies, payload: { paidAt: isoDay(-1) } });
    expect(pay.json()).toMatchObject({ status: "PAGO", paidAt: isoDay(-1) });

    expect((await app.inject({ method: "PATCH", url: `/boletos/${id}/pay`, cookies })).statusCode).toBe(409);

    const unpay = await app.inject({ method: "PATCH", url: `/boletos/${id}/unpay`, cookies });
    expect(unpay.json()).toMatchObject({ status: "PENDENTE", paidAt: null });
    expect((await app.inject({ method: "PATCH", url: `/boletos/${id}/unpay`, cookies })).statusCode).toBe(409);
  });

  it("atualiza, exclui e isola por usuário", async () => {
    const { id } = (await createBoleto()).json();

    const put = await app.inject({ method: "PUT", url: `/boletos/${id}`, cookies, payload: { ...baseBoleto(), feesCents: 0 } });
    expect(put.json()).toMatchObject({ feesCents: 0, totalCents: 48790 });

    const intruder = await createSession(app, "intruso@exemplo.com");
    const forbidden = await Promise.all([
      app.inject({ method: "GET", url: `/boletos/${id}`, cookies: intruder.cookies }),
      app.inject({ method: "PATCH", url: `/boletos/${id}/pay`, cookies: intruder.cookies }),
      app.inject({ method: "DELETE", url: `/boletos/${id}`, cookies: intruder.cookies }),
    ]);
    expect(forbidden.map((r) => r.statusCode)).toEqual([404, 404, 404]);

    expect((await app.inject({ method: "DELETE", url: `/boletos/${id}`, cookies })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/boletos/${id}`, cookies })).statusCode).toBe(404);
  });
});
