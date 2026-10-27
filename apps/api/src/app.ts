import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError, z } from "zod";
import { env } from "./env";
import { registerSession } from "./lib/session";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { supplierRoutes } from "./routes/suppliers";
import { taxRoutes } from "./routes/taxes";
import { boletoRoutes } from "./routes/boletos";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : env.NODE_ENV === "development" ? { level: "info" } : true,
    // Atrás do proxy do Render/Vercel: usa o IP real do cliente (rate limit)
    trustProxy: env.NODE_ENV === "production",
  });

  // Em produção o front chama a API pelo rewrite /api da Vercel (mesma origem);
  // o CORS cobre chamadas diretas durante o desenvolvimento.
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  // global: false → só as rotas com config.rateLimit são limitadas
  await app.register(rateLimit, { global: false });
  await registerSession(app);

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
  await app.register(authRoutes);
  // Cada plugin aplica app.authenticate a todas as suas rotas via addHook
  await app.register(supplierRoutes);
  await app.register(taxRoutes);
  await app.register(boletoRoutes);

  return app;
}
