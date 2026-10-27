import { Construction } from "lucide-react";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        <Construction className="size-6" aria-hidden />
        Módulo em construção.
      </div>
    </div>
  );
}
