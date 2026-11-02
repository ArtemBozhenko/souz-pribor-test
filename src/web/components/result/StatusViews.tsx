import { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";

const EXPECTED_MS = 60_000;

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      <FileText className="size-8" />
      <p>Заполните данные о приборе и нажмите «Сгенерировать».</p>
      <p>Карточка появится здесь по блокам, каждый можно скопировать в CMS.</p>
    </div>
  );
}

export function LoadingState({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - startedAt);
  const percent = Math.min(95, Math.round((elapsed / EXPECTED_MS) * 100));
  return (
    <div role="status" className="space-y-3 rounded-lg border border-border p-6 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Loader2 className="size-4 animate-spin" /> Генерация карточки… {Math.floor(elapsed / 1000)} с
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-muted-foreground">Обычно занимает до минуты.</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertCircle className="size-5 shrink-0" />
      <div>
        <p className="font-semibold">Не удалось сгенерировать карточку</p>
        <p>{message}</p>
      </div>
    </div>
  );
}
