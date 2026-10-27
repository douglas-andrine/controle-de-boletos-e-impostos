import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { SESSION_COOKIE } from "../src/lib/session";
import { DEMO_EMAIL } from "../src/lib/demo";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE users CASCADE");
});

const validUser = { name: "Maria Silva", email: "maria@exemplo.com", password: "senhaSegura123" };

type InjectedCookie = { name: string; value: string; httpOnly?: boolean; sameSite?: string; expires?: Date };

function sessionCookie(res: { cookies: InjectedCookie[] }) {
  return res.cookies.find((c) => c.name === SESSION_COOKIE);
}

describe("POST /auth/register", () => {
  it("cria o usuário, abre sessão em cookie HTTP-only e não expõe o hash", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: validUser });

    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ name: "Maria Silva", email: "maria@exemplo.com", provider: "LOCAL" });
    expect(res.json().user).not.toHaveProperty("passwordHash");

    const cookie = sessionCookie(res);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "maria@exemplo.com" } });
    expect(stored.passwordHash).not.toBe(validUser.password);
  });

  it("normaliza o email para minúsculas", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...validUser, email: "  Maria@Exemplo.COM " },
    });
    expect(res.json().user.email).toBe("maria@exemplo.com");
  });

  it("recusa email já cadastrado com 409", async () => {
    await app.inject({ method: "POST", url: "/auth/register", payload: validUser });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: validUser });
    expect(res.statusCode).toBe(409);
  });

  it("retorna 400 com erros por campo quando os dados são inválidos", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "", email: "nao-e-email", password: "123" },
    });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().issues)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await app.inject({ method: "POST", url: "/auth/register", payload: validUser });
  });

  it("autentica com credenciais corretas", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: validUser.email, password: validUser.password },
    });
    expect(res.statusCode).toBe(200);
    expect(sessionCookie(res)?.value).toBeTruthy();
  });

  it("usa a mesma mensagem para senha errada e email inexistente", async () => {
    const wrongPassword = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: validUser.email, password: "outraSenha" },
    });
    const unknownEmail = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ninguem@exemplo.com", password: "qualquer" },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json().message).toBe(unknownEmail.json().message);
    expect(sessionCookie(wrongPassword)).toBeUndefined();
  });
});

describe("GET /auth/me e POST /auth/logout", () => {
  it("retorna 401 sem sessão", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("retorna 401 com token adulterado", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me", cookies: { [SESSION_COOKIE]: "token.invalido.123" } });
    expect(res.statusCode).toBe(401);
  });

  it("retorna o usuário logado e encerra a sessão no logout", async () => {
    const register = await app.inject({ method: "POST", url: "/auth/register", payload: validUser });
    const token = sessionCookie(register)!.value;

    const me = await app.inject({ method: "GET", url: "/auth/me", cookies: { [SESSION_COOKIE]: token } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(validUser.email);

    const logout = await app.inject({ method: "POST", url: "/auth/logout", cookies: { [SESSION_COOKIE]: token } });
    expect(logout.statusCode).toBe(204);
    const cleared = sessionCookie(logout);
    expect(cleared?.value).toBe("");
    expect(cleared?.expires?.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("POST /auth/demo", () => {
  it("cria o usuário demo com dados de exemplo e reaproveita nas próximas entradas", async () => {
    const first = await app.inject({ method: "POST", url: "/auth/demo" });
    expect(first.statusCode).toBe(200);
    expect(first.json().user.email).toBe(DEMO_EMAIL);
    expect(sessionCookie(first)?.value).toBeTruthy();

    const demo = await prisma.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
      include: { _count: { select: { suppliers: true, boletos: true, taxes: true } } },
    });
    expect(demo._count.suppliers).toBeGreaterThan(0);
    expect(demo._count.boletos).toBeGreaterThan(0);
    expect(demo._count.taxes).toBeGreaterThan(0);

    const second = await app.inject({ method: "POST", url: "/auth/demo" });
    expect(second.json().user.id).toBe(first.json().user.id);
  });
});
