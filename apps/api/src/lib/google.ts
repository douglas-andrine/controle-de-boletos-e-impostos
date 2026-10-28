// Login com Google pelo fluxo Authorization Code (OAuth 2.0 / OpenID Connect).
// A troca do código acontece no servidor, então o client secret nunca chega ao navegador.
import { env } from "../env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleProfile = { sub: string; email: string; name: string };

export const isGoogleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

// O callback passa pelo /api do front (rewrite da Vercel / proxy do Vite), assim o
// cookie de sessão nasce na mesma origem do site, como no login por senha.
export const googleRedirectUri = () => `${env.WEB_ORIGIN}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

/** Troca o código de autorização pelo perfil do usuário; lança erro se o Google recusar. */
export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token: HTTP ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) throw new Error(`Google userinfo: HTTP ${infoRes.status}`);
  const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };

  // Sem email verificado não dá para vincular com segurança a uma conta existente
  if (!info.email || !info.email_verified) throw new Error("Google: email não verificado");
  const email = info.email.toLowerCase();
  return { sub: info.sub, email, name: info.name?.trim() || email.split("@")[0]! };
}
