import type { FastifyInstance, FastifyReply } from "fastify";
import jwt from "@fastify/jwt";
import { env } from "../env";

export const SESSION_COOKIE = "tl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

// Registrado direto na instância raiz (sem encapsulamento) para que
// app.authenticate e app.jwt fiquem disponíveis em todas as rotas.
export async function registerSession(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: SESSION_TTL_SECONDS },
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Sessão expirada ou inválida" });
    }
  });
}

export function startSession(app: FastifyInstance, reply: FastifyReply, userId: string) {
  const token = app.jwt.sign({ sub: userId });
  // HTTP-only: o JavaScript do front nunca lê o token (protege contra XSS).
  // SameSite=Lax funciona porque, em produção, front e API compartilham a
  // origem via rewrite /api da Vercel.
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}
