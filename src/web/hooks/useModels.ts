/** Выбор модели: список с сервера, выбор запоминается в браузере. Пока список не загружен — model undefined. */
import { useCallback, useEffect, useState } from "react";
import type { ModelsResponse } from "../../contract";
import { fetchModels } from "../lib/api-client";

export const MODEL_STORAGE_KEY = "souz-pribor:model";

function readStored(): string | null {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    // Хранилище недоступно (приватный режим) — выбор живёт до перезагрузки.
  }
}

export function useModels() {
  const [list, setList] = useState<ModelsResponse | null>(null);
  const [model, setModelState] = useState<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    void fetchModels(controller.signal).then((data) => {
      if (!data || controller.signal.aborted) return;
      const stored = readStored();
      setList(data);
      setModelState(stored && data.models.some((m) => m.id === stored) ? stored : data.default);
    });
    return () => controller.abort();
  }, []);

  const setModel = useCallback((id: string) => {
    setModelState(id);
    writeStored(id);
  }, []);

  return { list, model, setModel };
}
