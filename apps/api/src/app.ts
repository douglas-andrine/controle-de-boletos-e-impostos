import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError, z } from "zod";
import { env } from "./env";
import { healthRoutes } from "./routes/health";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development" ? { level: "info" } : true,
  });

  // Em produção o front chama a API pelo rewrite /api da Vercel (mesma origem);
  // o CORS cobre chamadas diretas durante o desenvolvimento.
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);

  app.setErrorHandler<FastifyError | ZodError>((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Dados inválidos",
        issues: z.flattenError(error).fieldErrors,
      });
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) app.log.error(error);
    return reply.status(statusCode).send({
      message: statusCode >= 500 ? "Erro interno do servidor" : error.message,
    });
  });

  await app.register(healthRoutes);

  return app;
}
