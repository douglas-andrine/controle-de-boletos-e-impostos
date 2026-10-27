import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { endSession, startSession } from "../lib/session";
import { ensureDemoUser } from "../lib/demo";

const BCRYPT_ROUNDS = 10;
// Comparado quando o email não existe, para que a resposta leve o mesmo tempo
// e não revele quais emails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync("tributoleao-dummy-password", BCRYPT_ROUNDS);

const authRateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

function toPublicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, provider: user.provider };
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
