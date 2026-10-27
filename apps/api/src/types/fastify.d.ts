import "@fastify/jwt";
import type { preHandlerAsyncHookHandler } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler que exige sessão válida; popula request.user.sub */
    authenticate: preHandlerAsyncHookHandler;
  }
}
