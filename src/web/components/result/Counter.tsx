import { cn } from "@/lib/utils";

/** Счётчик символов: красный вне нормы. */
export function Counter({ length, min, max }: { length: number; min?: number; max: number }) {
  const bad = length > max || (min !== undefined && length < min);
  const norm = min !== undefined ? `норма ${min}–${max}` : `из ${max}`;
  return (
    <span
      data-testid="counter"
      data-invalid={bad}
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
        bad ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {min !== undefined ? `${length} симв., ${norm}` : `${length}/${max}`}
    </span>
  );
}
