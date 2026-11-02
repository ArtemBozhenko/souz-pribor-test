/** Состояние запроса генерации: пусто → загрузка → результат | ошибка. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductCard, ProductInput } from "../../contract";
import { ApiClientError, generateCard } from "../lib/api-client";

export type GenerateState =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "success"; card: ProductCard }
  | { status: "error"; message: string };

export function useGenerate() {
  const [state, setState] = useState<GenerateState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (input: ProductInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading", startedAt: Date.now() });
    try {
      const card = await generateCard(input, controller.signal);
      if (!controller.signal.aborted) setState({ status: "success", card });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof ApiClientError ? err.message : "Не удалось получить карточку. Повторите попытку.";
      setState({ status: "error", message });
    }
  }, []);

  return { state, run };
}
