import { AlertTriangle } from "lucide-react";
import type { Spec } from "../../../contract";
import { Badge } from "@/components/ui/badge";
import { formatSpecValue, groupSpecs, specsText } from "@/lib/card-text";
import { BlockCard } from "./BlockCard";

export function SpecsBlock({ specs }: { specs: Spec[] }) {
  return (
    <BlockCard title="Характеристики" copy={specsText(specs)}>
      {specs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Характеристик нет.</p>
      ) : (
        <div className="space-y-4">
          {groupSpecs(specs).map(([group, items]) => (
            <div key={group}>
              <h4 className="mb-1 text-sm font-semibold">{group}</h4>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((s, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="w-1/2 py-1.5 pr-3 align-top text-muted-foreground">{s.name}</td>
                      <td className="py-1.5 align-top break-words">
                        {s.source === "missing" ? (
                          <Badge
                            variant="outline"
                            data-testid="no-data"
                            className="gap-1 border-amber-300 bg-amber-50 text-amber-800"
                          >
                            <AlertTriangle className="size-3" />
                            {s.value}
                          </Badge>
                        ) : (
                          <span
                            title={s.source_quote ? `Источник: «${s.source_quote}»` : undefined}
                            className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4"
                          >
                            {formatSpecValue(s)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </BlockCard>
  );
}
