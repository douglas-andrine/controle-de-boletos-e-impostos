import type { ReactNode } from "react";
import { CircleAlert, Info } from "lucide-react";

const tones = {
  error: { box: "border-danger/30 bg-danger/5 text-danger", Icon: CircleAlert },
  info: { box: "border-gold/40 bg-gold/10 text-navy", Icon: Info },
};

export function Alert({ tone = "error", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${box}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
