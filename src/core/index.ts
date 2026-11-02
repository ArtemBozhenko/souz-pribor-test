/**
 * Ядро: общая точка входа для сервера и CLI.
 * Конвейер: input → prompts → llm → checks → render.
 *
 * generateCard(input) → ProductCard. Ошибки — CoreError (code + русское сообщение),
 * `err.toApiError()` даёт ApiError, `err.httpStatus` — статус ответа.
 * Без LLM_API_KEY возвращается статичная заглушка (для e2e и демо без ключа).
 */
import { ProductCardSchema, type ProductCard, type ProductInput } from "../contract";
import { CoreError } from "./errors";
import { createLlmClient, listModels, readLlmConfig, type LlmClient, type LlmConfig } from "./llm";
import { runPipeline } from "./pipeline";
import { STUB_CARD } from "./stub-card";

export type GenerateCard = (input: ProductInput) => Promise<ProductCard>;

export interface GenerateOptions {
  /** Подменённый клиент модели (тесты); по умолчанию — из env. */
  client?: LlmClient | null;
  log?: (message: string) => void;
  /** Окружение с настройками LLM; по умолчанию — process.env. */
  env?: NodeJS.ProcessEnv;
  /** Фабрика клиента по настройкам с выбранной моделью (тесты); по умолчанию — createLlmClient. */
  createClient?: (cfg: LlmConfig) => LlmClient | null;
}

/** Модель запроса: из списка доступных или по умолчанию. Вне списка — unsupported_model, без подмены. */
export function resolveModel(cfg: LlmConfig, requested: string | undefined): string {
  const list = listModels(cfg);
  const model = requested?.trim();
  if (!model) return list.default;
  if (!list.models.some((m) => m.id === model)) {
    const ids = list.models.map((m) => m.id);
    throw new CoreError("unsupported_model", `Модель «${model}» не поддерживается. Доступные: ${ids.join(", ")}.`, {
      details: { models: ids },
    });
  }
  return model;
}

export async function generateCard(input: ProductInput, options: GenerateOptions = {}): Promise<ProductCard> {
  const cfg = readLlmConfig(options.env);
  const model = resolveModel(cfg, input.model);
  const client =
    options.client !== undefined
      ? options.client
      : (options.createClient ?? createLlmClient)({ ...cfg, LLM_MODEL: model });
  if (!client) {
    const stub = structuredClone(STUB_CARD);
    stub.meta.model = model;
    return ProductCardSchema.parse(stub);
  }
  return runPipeline(input, { client, ...(options.log ? { log: options.log } : {}) });
}

export { STUB_CARD };
export { listModels, readLlmConfig, type ModelList } from "./llm";
export { CoreError, isCoreError, mapProviderError, type CoreErrorCode } from "./errors";
export { parseInputJson, normalizeInput } from "./input";
export { renderMarkdown } from "./render";
export type { LlmClient, LlmResponse, ChatMessage } from "./llm";
