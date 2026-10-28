import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { env } from "../src/env";
import { prisma } from "../src/lib/prisma";
import { SESSION_COOKIE } from "../src/lib/session";
import { resetDb } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(resetDb);

afterEach(() => {
  vi.unstubAllGlobals();
});

const STATE = "estado-aleatorio";
const googleProfile = { sub: "google-123", email: "Maria@Gmail.com", email_verified: true, name: "Maria Silva" };

/** Simula o token endpoint e o userinfo do Google, devolvendo `profile`. */
function mockGoogle(profile: Record<string, unknown> = googleProfile, tokenStatus = 200) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "token-de-acesso" }, { status: tokenStatus });
    }
    return Response.json(profile);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callback(query = `code=abc&state=${STATE}`, state: string | undefined = STATE) {
  return app.inject({
    method: "GET",
    url: `/auth/google/callback?${query}`,
    cookies: state ? { tl_oauth_state: state } : {},
  });
}

const sessionCookie = (res: { cookies: { name: string; value: string }[] }) =>
  res.cookies.find((c) => c.name === SESSION_COOKIE);

describe("GET /auth/google", () => {
  it("redireciona para o Google com state guardado em cookie HTTP-only", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/google" });

    expect(res.statusCode).toBe(302);
    const location = new URL(res.headers.location as string);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("redirect_uri")).toBe(`${env.WEB_ORIGIN}/api/auth/google/callback`);
    expect(location.searchParams.get("scope")).toBe("openid email profile");

    const stateCookie = res.cookies.find((c) => c.name === "tl_oauth_state");
    expect(stateCookie?.httpOnly).toBe(true);
    expect(location.searchParams.get("state")).toBe(stateCookie?.value);
  });
});

describe("GET /auth/google/callback", () => {
  it("cria a conta Google, abre sessão e volta para o app", async () => {
    mockGoogle();
    const res = await callback();

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/`);
    expect(sessionCookie(res)?.value).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "maria@gmail.com" } });
    expect(user).toMatchObject({ name: "Maria Silva", googleId: "google-123", provider: "GOOGLE", passwordHash: null });
  });

  it("vincula ao usuário que já tinha conta com o mesmo email", async () => {
    const existing = await prisma.user.create({
      data: { name: "Maria", email: "maria@gmail.com", passwordHash: "hash" },
    });
    mockGoogle();

    const res = await callback();
    expect(sessionCookie(res)?.value).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(user).toMatchObject({ googleId: "google-123", provider: "LOCAL", passwordHash: "hash" });
    expect(await prisma.user.count()).toBe(1);
  });

  it("reconhece a conta pelo googleId mesmo se o email do Google mudou", async () => {
    const existing = await prisma.user.create({
      data: { name: "Maria", email: "antigo@gmail.com", googleId: "google-123", provider: "GOOGLE" },
    });
    mockGoogle();

    await callback();
    expect(await prisma.user.count()).toBe(1);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(me.email).toBe("antigo@gmail.com");
  });

  it("recusa state diferente do cookie (CSRF) sem chamar o Google", async () => {
    const fetchMock = mockGoogle();
    const res = await callback(`code=abc&state=${STATE}`, "outro-state");

    expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/login?erro=google`);
    expect(sessionCookie(res)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("volta para o login quando o usuário cancela na tela do Google", async () => {
    const res = await callback(`error=access_denied&state=${STATE}`);
    expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/login?erro=google`);
  });

  it("recusa email não verificado pelo Google", async () => {
    mockGoogle({ ...googleProfile, email_verified: false });
    const res = await callback();

    expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/login?erro=google`);
    expect(await prisma.user.count()).toBe(0);
  });

  it("volta para o login quando o Google recusa o código", async () => {
    mockGoogle(googleProfile, 400);
    const res = await callback();

    expect(res.headers.location).toBe(`${env.WEB_ORIGIN}/login?erro=google`);
    expect(sessionCookie(res)).toBeUndefined();
  });
});
