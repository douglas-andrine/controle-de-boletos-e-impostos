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

  it("cadastra só com nome fantasia e categoria", async () => {
    const res = await createSupplier({ tradeName: " Mercado Bom Preço ", category: "Mercadorias" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      tradeName: "Mercado Bom Preço",
      category: "Mercadorias",
      legalName: null,
      document: null,
      email: null,
      phone: null,
    });
  });

  it("exige o nome fantasia", async () => {
    const res = await createSupplier({ legalName: "Sem Fantasia Ltda.", category: "Serviços" });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().issues)).toEqual(["tradeName"]);
  });

  it("permite vários fornecedores sem CPF/CNPJ", async () => {
    expect((await createSupplier({ tradeName: "Feira do Zé" })).statusCode).toBe(201);
    expect((await createSupplier({ tradeName: "Hortifruti da Esquina" })).statusCode).toBe(201);
  });

  it("aceita email vazio e o grava como null", async () => {
    const res = await createSupplier({ ...validSupplier, email: "" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: null });
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
    await createSupplier({ tradeName: "Conecta", legalName: "Conecta Telecom Ltda.", document: "45723174000110" });
    await createSupplier({ tradeName: "Papelaria Central" });

    const all = await app.inject({ method: "GET", url: "/suppliers?pageSize=2", cookies });
    expect(all.json().data).toHaveLength(2);
    expect(all.json().meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    // Ordenado por nome fantasia
    expect(all.json().data[0].tradeName).toBe("Conecta");

    const byName = await app.inject({ method: "GET", url: "/suppliers?search=papelaria", cookies });
    expect(byName.json().data.map((s: { tradeName: string }) => s.tradeName)).toEqual(["Papelaria Central"]);

    const byLegalName = await app.inject({ method: "GET", url: "/suppliers?search=telecom", cookies });
    expect(byLegalName.json().data.map((s: { tradeName: string }) => s.tradeName)).toEqual(["Conecta"]);

    const byDoc = await app.inject({ method: "GET", url: `/suppliers?search=${encodeURIComponent("45.723.174")}`, cookies });
    expect(byDoc.json().data).toHaveLength(1);
    expect(byDoc.json().data[0].document).toBe("45723174000110");
  });

  it("atualiza nome fantasia e categoria sem apagar os dados que o formulário não envia", async () => {
    const { id } = (await createSupplier()).json();
    const res = await app.inject({ method: "PUT", url: `/suppliers/${id}`, cookies, payload: { tradeName: "Luz & Força Energia" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      tradeName: "Luz & Força Energia",
      category: null, // enviado vazio = limpo
      legalName: validSupplier.legalName,
      document: "11222333000181",
      email: validSupplier.email,
      phone: validSupplier.phone,
    });
  });

  it("fornecedor antigo sem nome fantasia continua listado e encontrável pela razão social", async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { email: "dono@exemplo.com" } });
    await prisma.supplier.create({ data: { userId: owner.id, legalName: "Antiga Comércio Ltda.", document: "45723174000110" } });

    const res = await app.inject({ method: "GET", url: "/suppliers?search=antiga", cookies });
    expect(res.json().data).toEqual([expect.objectContaining({ tradeName: null, legalName: "Antiga Comércio Ltda." })]);
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

    const free = (await createSupplier({ tradeName: "Sem Boletos" })).json();
    const ok = await app.inject({ method: "DELETE", url: `/suppliers/${free.id}`, cookies });
    expect(ok.statusCode).toBe(204);
  });
});
