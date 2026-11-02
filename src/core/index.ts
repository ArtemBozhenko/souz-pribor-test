/**
 * Ядро: общая точка входа для сервера и CLI.
 * Конвейер: input → prompts → llm → checks → render.
 *
 * generateCard(input) → ProductCard. Ошибки — CoreError (code + русское сообщение),
 * `err.toApiError()` даёт ApiError, `err.httpStatus` — статус ответа.
 * Без LLM_API_KEY возвращается статичная заглушка (для e2e и демо без ключа).
 */
import { ProductCardSchema, type ProductCard, type ProductInput } from "../contract";
import { createLlmClient, readLlmConfig, type LlmClient } from "./llm";
import { runPipeline } from "./pipeline";
import { STUB_CARD } from "./stub-card";

export type GenerateCard = (input: ProductInput) => Promise<ProductCard>;

export interface GenerateOptions {
  /** Подменённый клиент модели (тесты); по умолчанию — из env. */
  client?: LlmClient | null;
  log?: (message: string) => void;
}

export async function generateCard(input: ProductInput, options: GenerateOptions = {}): Promise<ProductCard> {
  const client = options.client !== undefined ? options.client : createLlmClient(readLlmConfig());
  if (!client) return ProductCardSchema.parse(structuredClone(STUB_CARD));
  return runPipeline(input, { client, ...(options.log ? { log: options.log } : {}) });
}

export { STUB_CARD };
export { CoreError, isCoreError, mapProviderError, type CoreErrorCode } from "./errors";
export { parseInputJson, normalizeInput } from "./input";
export { renderMarkdown } from "./render";
export type { LlmClient, LlmResponse, ChatMessage } from "./llm";
