import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch (err) {
      app.log.error(err, "health check: banco indisponível");
      return reply.status(503).send({ status: "degraded", database: "unavailable" });
    }
  });
}
