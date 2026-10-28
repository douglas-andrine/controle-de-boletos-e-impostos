import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AuthProvider, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema } from "@tributoleao/shared";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { endSession, startSession } from "../lib/session";
import { ensureDemoUser } from "../lib/demo";
import { fetchGoogleProfile, googleAuthUrl, isGoogleConfigured, type GoogleProfile } from "../lib/google";

const BCRYPT_ROUNDS = 10;
// Comparado quando o email não existe, para que a resposta leve o mesmo tempo
// e não revele quais emails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync("tributoleao-dummy-password", BCRYPT_ROUNDS);

const authRateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

const OAUTH_STATE_COOKIE = "tl_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 60 * 10; // tempo para concluir a tela do Google

function toPublicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, provider: user.provider };
}

const loginErrorUrl = (code: string) => `${env.WEB_ORIGIN}/login?erro=${code}`;

/**
 * Entra pela conta já vinculada ao Google; senão vincula pelo email (o Google
 * garante que ele foi verificado), e só então cria uma conta nova sem senha.
 */
async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const linked = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (linked) return linked;

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    return prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.sub } });
  }

  return prisma.user.create({
    data: { name: profile.name, email: profile.email, googleId: profile.sub, provider: AuthProvider.GOOGLE },
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", { config: authRateLimit }, async (request, reply) => {
    const data = registerSchema.parse(request.body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return reply.status(409).send({ message: "Este email já está cadastrado" });

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      },
    });

    startSession(app, reply, user.id);
    return reply.status(201).send({ user: toPublicUser(user) });
  });

  app.post("/auth/login", { config: authRateLimit }, async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    // Contas criadas só via Google não têm senha
    if (!user || !user.passwordHash || !passwordOk) {
      return reply.status(401).send({ message: "Email ou senha inválidos" });
    }

    startSession(app, reply, user.id);
    return { user: toPublicUser(user) };
  });

  app.post("/auth/demo", { config: authRateLimit }, async (_request, reply) => {
    const user = await ensureDemoUser(prisma);
    startSession(app, reply, user.id);
    return { user: toPublicUser(user) };
  });

  // Login com Google: /auth/google manda para a tela do Google, que volta no callback.
  // Os dois respondem com redirect, nunca JSON, porque o navegador navega até eles.
  app.get("/auth/google", { config: authRateLimit }, async (_request, reply) => {
    if (!isGoogleConfigured()) return reply.redirect(loginErrorUrl("google_indisponivel"));

    // `state` amarra o callback a este navegador (proteção contra CSRF no login)
    const state = randomBytes(32).toString("base64url");
    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: OAUTH_STATE_TTL_SECONDS,
    });
    return reply.redirect(googleAuthUrl(state));
  });

  app.get("/auth/google/callback", { config: authRateLimit }, async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    const expectedState = request.cookies[OAUTH_STATE_COOKIE];
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    // Sem code: o usuário cancelou na tela do Google (?error=access_denied)
    if (!isGoogleConfigured() || !code || !state || state !== expectedState) {
      return reply.redirect(loginErrorUrl("google"));
    }

    let profile: GoogleProfile;
    try {
      profile = await fetchGoogleProfile(code);
    } catch (err) {
      request.log.warn({ err }, "falha no login com Google");
      return reply.redirect(loginErrorUrl("google"));
    }

    const user = await findOrCreateGoogleUser(profile);
    startSession(app, reply, user.id);
    return reply.redirect(`${env.WEB_ORIGIN}/`);
  });

  app.post("/auth/logout", async (_request, reply) => {
    endSession(reply);
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) {
      endSession(reply);
      return reply.status(401).send({ message: "Usuário não encontrado" });
    }
    return { user: toPublicUser(user) };
  });
}
