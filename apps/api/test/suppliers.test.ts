import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createSession, isoDay, resetDb, validSupplier } from "./helpers";

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

const createSupplier = (payload: object = validSupplier) =>
  app.inject({ method: "POST", url: "/suppliers", cookies, payload });

describe("Fornecedores", () => {
  it("exige sessão", async () => {
    const res = await app.inject({ method: "GET", url: "/suppliers" });
    expect(res.statusCode).toBe(401);
  });

  it("cria fornecedor guardando o CNPJ só com dígitos", async () => {
    const res = await createSupplier();
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ legalName: validSupplier.legalName, document: "11222333000181", boletoCount: 0 });
    expect(res.json()).not.toHaveProperty("userId");
  });

  it("aceita email vazio e o grava como null", async () => {
    const res = await createSupplier({ ...validSupplier, email: "", tradeName: "  " });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: null, tradeName: null });
  });

  it("rejeita CNPJ com dígito verificador inválido", async () => {
    const res = await createSupplier({ ...validSupplier, document: "11.222.333/0001-82" });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.document).toBeDefined();
  });

  it("rejeita CPF/CNPJ duplicado para o mesmo usuário, mas permite para outro", async () => {
    await createSupplier();
    expect((await createSupplier()).statusCode).toBe(409);

    const other = await createSession(app, "outro@exemplo.com");
    const res = await app.inject({ method: "POST", url: "/suppliers", cookies: other.cookies, payload: validSupplier });
    expect(res.statusCode).toBe(201);
  });

  it("lista com busca por nome ou CNPJ formatado e paginação", async () => {
    await createSupplier();
    await createSupplier({ legalName: "Conecta Telecom Ltda.", document: "45723174000110" });
    await createSupplier({ legalName: "Papelaria Central ME", document: "19131243000197" });

    const all = await app.inject({ method: "GET", url: "/suppliers?pageSize=2", cookies });
    expect(all.json().data).toHaveLength(2);
    expect(all.json().meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    // Ordenado por razão social
    expect(all.json().data[0].legalName).toBe("Conecta Telecom Ltda.");

    const byName = await app.inject({ method: "GET", url: "/suppliers?search=papelaria", cookies });
    expect(byName.json().data.map((s: { legalName: string }) => s.legalName)).toEqual(["Papelaria Central ME"]);

    const byDoc = await app.inject({ method: "GET", url: `/suppliers?search=${encodeURIComponent("45.723.174")}`, cookies });
    expect(byDoc.json().data).toHaveLength(1);
    expect(byDoc.json().data[0].document).toBe("45723174000110");
  });

  it("atualiza substituindo campos opcionais omitidos por null", async () => {
    const { id } = (await createSupplier()).json();
    const res = await app.inject({
      method: "PUT",
      url: `/suppliers/${id}`,
      cookies,
      payload: { legalName: "Luz & Força Energia S.A.", document: "11222333000181" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ legalName: "Luz & Força Energia S.A.", email: null, category: null });
  });

  it("não deixa outro usuário ler, editar ou excluir o fornecedor", async () => {
    const { id } = (await createSupplier()).json();
    const intruder = await createSession(app, "intruso@exemplo.com");

    const get = await app.inject({ method: "GET", url: `/suppliers/${id}`, cookies: intruder.cookies });
    const put = await app.inject({ method: "PUT", url: `/suppliers/${id}`, cookies: intruder.cookies, payload: validSupplier });
    const del = await app.inject({ method: "DELETE", url: `/suppliers/${id}`, cookies: intruder.cookies });
    const list = await app.inject({ method: "GET", url: "/suppliers", cookies: intruder.cookies });

    expect([get.statusCode, put.statusCode, del.statusCode]).toEqual([404, 404, 404]);
    expect(list.json().data).toHaveLength(0);
  });

  it("bloqueia exclusão de fornecedor com boletos e permite sem boletos", async () => {
    const { id } = (await createSupplier()).json();
    await app.inject({
      method: "POST",
      url: "/boletos",
      cookies,
      payload: { supplierId: id, description: "Conta de energia", amountCents: 10000, issueDate: isoDay(-5), dueDate: isoDay(5) },
    });

    const blocked = await app.inject({ method: "DELETE", url: `/suppliers/${id}`, cookies });
    expect(blocked.statusCode).toBe(409);

    const detail = await app.inject({ method: "GET", url: `/suppliers/${id}`, cookies });
    expect(detail.json().boletoCount).toBe(1);

    const free = (await createSupplier({ legalName: "Sem Boletos", document: "45723174000110" })).json();
    const ok = await app.inject({ method: "DELETE", url: `/suppliers/${free.id}`, cookies });
    expect(ok.statusCode).toBe(204);
  });
});
