import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createSession, resetDb } from "./helpers";

let app: FastifyInstance;
let adminCookies: Record<string, string>;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  const admin = await createSession(app, "admin@exemplo.com");
  await prisma.user.update({ where: { id: admin.user.id }, data: { role: "ADMIN" } });
  adminCookies = admin.cookies;
});

const newUser = { name: "Maria Souza", email: " Maria@Exemplo.com ", password: "senha-forte-123" };

const createUser = (cookies: Record<string, string>, payload: object = newUser) =>
  app.inject({ method: "POST", url: "/admin/users", cookies, payload });

describe("Usuários (admin)", () => {
  it("admin cria um usuário que consegue entrar com email e senha", async () => {
    const res = await createUser(adminCookies);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Maria Souza", email: "maria@exemplo.com", role: "USER", provider: "LOCAL" });
    expect(res.json()).not.toHaveProperty("passwordHash");

    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "maria@exemplo.com", password: newUser.password } });
    expect(login.statusCode).toBe(200);
    expect(login.json().user).toMatchObject({ email: "maria@exemplo.com", role: "USER" });
  });

  it("lista os usuários com o papel de cada um", async () => {
    await createUser(adminCookies);
    const res = await app.inject({ method: "GET", url: "/admin/users", cookies: adminCookies });
    expect(res.json().data.map((u: { email: string; role: string }) => [u.email, u.role])).toEqual([
      ["admin@exemplo.com", "ADMIN"],
      ["maria@exemplo.com", "USER"],
    ]);
  });

  it("recusa email repetido e senha curta", async () => {
    await createUser(adminCookies);
    expect((await createUser(adminCookies)).statusCode).toBe(409);
    expect((await createUser(adminCookies, { ...newUser, email: "outra@exemplo.com", password: "123" })).statusCode).toBe(400);
  });

  it("usuário comum não acessa a gestão de usuários", async () => {
    const { cookies } = await createSession(app, "comum@exemplo.com");
    expect((await app.inject({ method: "GET", url: "/admin/users", cookies })).statusCode).toBe(403);
    expect((await createUser(cookies)).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/admin/users" })).statusCode).toBe(401);
  });

  it("/auth/me informa o papel do usuário", async () => {
    const me = await app.inject({ method: "GET", url: "/auth/me", cookies: adminCookies });
    expect(me.json().user.role).toBe("ADMIN");
  });
});
