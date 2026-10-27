import { Prisma } from "@prisma/client";

/** Erro com status HTTP; o error handler devolve `message` ao cliente quando < 500. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (entity: string) => new HttpError(404, `${entity} não encontrado`);
export const conflict = (message: string) => new HttpError(409, message);

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
