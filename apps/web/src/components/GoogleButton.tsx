import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Mensagens para o ?erro= com que a API devolve o usuário ao /login
export const GOOGLE_ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente novamente.",
  google_indisponivel: "O login com Google ainda não está disponível. Use email e senha.",
};

/**
 * Link (não fetch) para /api/auth/google: o navegador precisa navegar até o
 * Google, e a API devolve o usuário já com o cookie de sessão.
 */
export function GoogleButton({ label = "Entrar com Google", disabled }: { label?: string; disabled?: boolean }) {
  const [redirecting, setRedirecting] = useState(false);
  const inactive = disabled || redirecting;

  // Ao voltar do Google pelo botão "voltar", o navegador restaura a página com o spinner
  useEffect(() => {
    const reset = () => setRedirecting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href="/api/auth/google"
      onClick={(e) => (inactive ? e.preventDefault() : setRedirecting(true))}
      aria-disabled={inactive}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${inactive ? "pointer-events-none opacity-60" : ""}`}
    >
      {redirecting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleIcon />}
      {label}
    </a>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
