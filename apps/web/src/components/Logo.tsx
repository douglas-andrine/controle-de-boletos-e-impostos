export function Logo({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={tone === "light" ? "#13315c" : "#0B2545"} />
        <path d="M9 10h14M16 10v13" stroke="#F0A500" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span className={`text-xl ${tone === "light" ? "text-white" : "text-navy"}`}>
        Tributo<span className="text-gold">Leão</span>
      </span>
    </span>
  );
}
