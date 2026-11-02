/**
 * Ядро: адаптеры провайдеров.
 * anthropic — @anthropic-ai/sdk (/v1/messages), openai-compatible — openai (/chat/completions).
 * Транспортные повторы делает SDK (max_retries=3, таймаут 60 с); смысловые — конвейер.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { CoreError, mapProviderError } from "../errors";
import { MODEL_OUTPUT_JSON_SCHEMA } from "./output-schema";
import type { LlmConfig } from "./config";

export { listModels, readLlmConfig, type LlmConfig, type ModelList, type ModelOption } from "./config";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  text: string;
  requestId?: string;
}

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  complete(request: { system: string; messages: ChatMessage[] }): Promise<LlmResponse>;
}

export const SDK_OPTIONS = { maxRetries: 3, timeout: 60_000 } as const;
const MAX_TOKENS = 8000;

function isTimeout(err: unknown): boolean {
  return err instanceof Anthropic.APIConnectionTimeoutError || err instanceof OpenAI.APIConnectionTimeoutError;
}

function wrap(err: unknown): CoreError {
  if (isTimeout(err)) {
    const e = mapProviderError(Object.assign(new Error("timeout"), { name: "APIConnectionTimeoutError" }));
    return new CoreError(e.code, e.message, { cause: err });
  }
  return mapProviderError(err);
}

/**
 * SDK Anthropic сам дописывает `/v1/messages`, поэтому общий для Zen адрес `…/zen/v1`
 * приводится к `…/zen`: один LLM_BASE_URL годится для обоих провайдеров.
 */
export function anthropicBaseUrl(base: string | undefined): string | null {
  return base ? base.replace(/\/+$/, "").replace(/\/v1$/, "") : null;
}

export function createAnthropicClient(cfg: LlmConfig, sdk?: Anthropic): LlmClient {
  const client =
    sdk ?? new Anthropic({ apiKey: cfg.LLM_API_KEY, baseURL: anthropicBaseUrl(cfg.LLM_BASE_URL), ...SDK_OPTIONS });
  const structured = cfg.LLM_STRUCTURED !== "off";
  return {
    provider: "anthropic",
    model: cfg.LLM_MODEL,
    async complete({ system, messages }) {
      let res: Anthropic.Message;
      try {
        // temperature не передаём: на Claude 5.x он даёт 400.
        res = await client.messages.create({
          model: cfg.LLM_MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          ...(cfg.LLM_EFFORT || structured
            ? {
                output_config: {
                  ...(cfg.LLM_EFFORT ? { effort: cfg.LLM_EFFORT } : {}),
                  ...(structured ? { format: { type: "json_schema" as const, schema: MODEL_OUTPUT_JSON_SCHEMA } } : {}),
                },
              }
            : {}),
        });
      } catch (err) {
        throw wrap(err);
      }
      const requestId = (res as { _request_id?: string | null })._request_id ?? undefined;
      if (res.stop_reason === "refusal") {
        throw new CoreError("llm_refusal", "Модель отказалась отвечать на запрос.", { requestId });
      }
      if (res.stop_reason === "max_tokens") {
        throw new CoreError("llm_truncated", "Ответ модели обрезан по лимиту токенов.", { requestId });
      }
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { text, ...(requestId ? { requestId } : {}) };
    },
  };
}

export function createOpenAiCompatibleClient(cfg: LlmConfig, sdk?: OpenAI): LlmClient {
  const client = sdk ?? new OpenAI({ apiKey: cfg.LLM_API_KEY, baseURL: cfg.LLM_BASE_URL, ...SDK_OPTIONS });
  // Structured outputs у OpenAI-совместимых провайдеров поддержаны неравномерно: только по явному «on».
  const structured = cfg.LLM_STRUCTURED === "on";
  return {
    provider: "openai-compatible",
    model: cfg.LLM_MODEL,
    async complete({ system, messages }) {
      let res: OpenAI.Chat.Completions.ChatCompletion;
      let requestId: string | undefined;
      try {
        const { data, request_id } = await client.chat.completions
          .create({
            model: cfg.LLM_MODEL,
            max_tokens: MAX_TOKENS,
            messages: [{ role: "system", content: system }, ...messages],
            ...(structured
              ? {
                  response_format: {
                    type: "json_schema" as const,
                    json_schema: { name: "product_card", schema: MODEL_OUTPUT_JSON_SCHEMA },
                  },
                }
              : {}),
          })
          .withResponse();
        res = data;
        requestId = request_id ?? undefined;
      } catch (err) {
        throw wrap(err);
      }
      const choice = res.choices[0];
      if (choice?.finish_reason === "length") {
        throw new CoreError("llm_truncated", "Ответ модели обрезан по лимиту токенов.", { requestId });
      }
      if (choice?.finish_reason === "content_filter" || choice?.message.refusal) {
        throw new CoreError("llm_refusal", "Модель отказалась отвечать на запрос.", { requestId });
      }
      return { text: choice?.message.content ?? "", ...(requestId ? { requestId } : {}) };
    },
  };
}

/** Клиент по настройкам; без ключа — null (ядро отдаёт заглушку). */
export function createLlmClient(cfg: LlmConfig): LlmClient | null {
  if (!cfg.LLM_API_KEY?.trim()) return null;
  return cfg.LLM_PROVIDER === "anthropic" ? createAnthropicClient(cfg) : createOpenAiCompatibleClient(cfg);
}
