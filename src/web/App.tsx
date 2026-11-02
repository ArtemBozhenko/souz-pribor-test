/** Веб (#4): единственный экран — ввод данных о приборе и карточка по блокам. */
import { Toaster } from "@/components/ui/sonner";
import { InputPanel } from "@/components/input/InputPanel";
import { ResultView } from "@/components/result/ResultView";
import { EmptyState, ErrorState, LoadingState } from "@/components/result/StatusViews";
import { useGenerate } from "@/hooks/useGenerate";
import { useModels } from "@/hooks/useModels";
import type { ProductInput } from "../contract";

export function App() {
  const { state, run } = useGenerate();
  const models = useModels();
  // Модель задаёт только список. Пока он не загрузился, поле model не передаётся (в том числе из JSON) —
  // сервер берёт модель по умолчанию.
  const submit = (input: ProductInput) => {
    const { model: _ignored, ...rest } = input;
    void _ignored;
    run(models.model ? { ...rest, model: models.model } : rest);
  };
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Генератор карточек товара</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          SEO-заголовок, описание, характеристики и коммерческий блок по данным о приборе.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <InputPanel
            loading={state.status === "loading"}
            onSubmit={submit}
            models={models.list?.models ?? null}
            model={models.model}
            onModelChange={models.setModel}
          />
        </div>
        <div className="min-w-0">
          {state.status === "idle" && <EmptyState />}
          {state.status === "loading" && <LoadingState startedAt={state.startedAt} />}
          {state.status === "error" && <ErrorState message={state.message} />}
          {state.status === "success" && <ResultView card={state.card} />}
        </div>
      </div>
      <Toaster />
    </main>
  );
}
