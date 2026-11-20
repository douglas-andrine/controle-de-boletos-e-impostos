import "@fastify/jwt";
import type { preHandlerAsyncHookHandler } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    // sv = sessionVersion do usuário quando o token foi emitido (ausente em tokens antigos)
    payload: { sub: string; sv?: number };
    user: { sub: string; sv?: number };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler que exige sessão válida; popula request.user.sub */
    authenticate: preHandlerAsyncHookHandler;
  }
}
