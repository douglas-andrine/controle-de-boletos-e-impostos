import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Loader2, Receipt, Landmark, Building2 } from "lucide-react";
import { formatBRL } from "@tributoleao/shared";

type ApiState = "loading" | "ok" | "error";

// Tela provisória da Fase 1: confirma que front, API e banco conversam.
export function App() {
  const [api, setApi] = useState<ApiState>("loading");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setApi(res.ok ? "ok" : "error"))
      .catch(() => setApi("error"));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-sm overflow-hidden">
        <header className="bg-navy px-6 py-8 text-white">
          <h1 className="text-3xl font-bold">
            Tributo<span className="text-gold">Leão</span>
          </h1>
          <p className="mt-1 text-sm text-slate-300">Gestão de boletos, tributos e fornecedores</p>
        </header>

        <section className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm">
            {api === "loading" && <Loader2 className="size-4 animate-spin text-slate-400" />}
            {api === "ok" && <CircleCheck className="size-4 text-emerald-brand" />}
            {api === "error" && <CircleX className="size-4 text-danger" />}
            <span>
              API:{" "}
              {api === "loading" ? "conectando… (o servidor gratuito pode levar alguns segundos)" : api === "ok" ? "online" : "indisponível"}
            </span>
          </div>

          <ul className="grid grid-cols-3 gap-3 text-center text-xs text-slate-600">
            <li className="rounded-lg border border-slate-200 p-3">
              <Landmark className="mx-auto mb-1 size-5 text-navy" />
              Impostos
            </li>
            <li className="rounded-lg border border-slate-200 p-3">
              <Receipt className="mx-auto mb-1 size-5 text-navy" />
              Boletos
            </li>
            <li className="rounded-lg border border-slate-200 p-3">
              <Building2 className="mx-auto mb-1 size-5 text-navy" />
              Fornecedores
            </li>
          </ul>

          <p className="text-xs text-slate-400">Exemplo de formatação compartilhada: {formatBRL(123456)}</p>
        </section>
      </div>
    </main>
  );
}
