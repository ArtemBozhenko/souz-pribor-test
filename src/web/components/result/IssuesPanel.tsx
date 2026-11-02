import { AlertTriangle, Info } from "lucide-react";
import type { ProductCard } from "../../../contract";

export function IssuesPanel({ card }: { card: ProductCard }) {
  const { missing_fields: missing, warnings } = card;
  if (!missing.length && !warnings.length) return null;
  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <section
          aria-label="Требует уточнения"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Требует уточнения
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            {missing.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.field}</span> — {m.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section aria-label="Предупреждения" className="rounded-lg border border-border bg-muted p-4 text-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Info className="size-4" /> Предупреждения
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
