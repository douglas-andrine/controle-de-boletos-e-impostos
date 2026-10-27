export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

/** Chama a API via /api (proxy do Vite em dev, rewrite da Vercel em produção). */
export async function api<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? "Erro inesperado", data.issues);
  return data as T;
}
