// Limite de tentativas de login por conta (email), além do limite por IP das rotas de auth.
// O limite por IP sozinho não basta: o IP vem do X-Forwarded-For, que quem chama pode trocar.
// Fica em memória, como o store padrão do @fastify/rate-limit (a API roda numa instância só).
// O @fastify/rate-limit não serve aqui: ele pula o segundo limitador de uma mesma requisição.

export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const PRUNE_ABOVE = 10_000; // limpa as janelas vencidas quando o mapa passa disso

const attempts = new Map<string, { count: number; resetAt: number }>();

function pruneExpired(now: number) {
  for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
}

/** Conta uma tentativa para o email; `allowed: false` a partir da 11ª dentro da janela. */
export function consumeLoginAttempt(email: string, now = Date.now()) {
  let entry = attempts.get(email);
  if (!entry || entry.resetAt <= now) {
    if (attempts.size >= PRUNE_ABOVE) pruneExpired(now);
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    attempts.set(email, entry);
  }
  entry.count += 1;
  return { allowed: entry.count <= LOGIN_MAX_ATTEMPTS, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

/** Login certo zera o contador, para quem errou algumas vezes não ficar bloqueado depois. */
export function clearLoginAttempts(email: string) {
  attempts.delete(email);
}
