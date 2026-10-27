import type { FastifyInstance } from "fastify";
import { todayISO } from "@tributoleao/shared";
import { prisma } from "../src/lib/prisma";
import { SESSION_COOKIE } from "../src/lib/session";

export async function resetDb() {
  await prisma.$executeRawUnsafe("TRUNCATE users CASCADE");
}

/**
 * Cria um usuário direto no banco e devolve o cookie de sessão. Evita passar por
 * /auth/register, que tem rate limit e faria a suíte receber 429.
 */
export async function createSession(app: FastifyInstance, email = "dono@exemplo.com") {
  const user = await prisma.user.create({ data: { name: "Usuário Teste", email } });
  return { user, cookies: { [SESSION_COOKIE]: app.jwt.sign({ sub: user.id }) } };
}

/** Data "AAAA-MM-DD" a `offset` dias de hoje (no fuso da aplicação). */
export function isoDay(offset: number): string {
  const [y, m, d] = todayISO().split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

export const validSupplier = {
  legalName: "Luz & Força Distribuidora S.A.",
  tradeName: "Luz & Força",
  document: "11.222.333/0001-81",
  email: "financeiro@luzeforca.com.br",
  phone: "(11) 3333-4444",
  category: "Energia",
};
