import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createUserSchema, type UserDTO } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, HttpError } from "../lib/errors";
import { BCRYPT_ROUNDS } from "./auth";

function serializeUser(u: User): UserDTO {
  return { id: u.id, name: u.name, email: u.email, role: u.role, provider: u.provider, createdAt: u.createdAt.toISOString() };
}

// Gestão de usuários, só para ADMIN. O papel é lido do banco a cada requisição
// (não vai no token), então tirar o admin de alguém vale na hora.
export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { role: true } });
    if (user?.role !== "ADMIN") throw new HttpError(403, "Acesso restrito ao administrador");
  });

  app.get("/admin/users", async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return { data: users.map(serializeUser) };
  });

  app.post("/admin/users", async (request, reply) => {
    const data = createUserSchema.parse(request.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw conflict("Este email já está cadastrado");

    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS) },
    });
    return reply.status(201).send(serializeUser(user));
  });
}
