/** Настройки LLM из переменных окружения. Ключ не логируется. */
import { z } from "zod";

const emptyToUndefined = z.literal("").transform(() => undefined);

export const LlmConfigSchema = z.object({
  LLM_PROVIDER: z.enum(["anthropic", "openai-compatible"]).default("anthropic"),
  LLM_BASE_URL: z.string().url().optional().or(emptyToUndefined),
  LLM_MODEL: z.string().trim().min(1).default("claude-sonnet-5-5"),
  /** Список моделей для выбора через запятую. Пусто — доступна только LLM_MODEL. */
  LLM_MODELS: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  /**
   * Предел выходных токенов на ответ (рассуждения модели + JSON карточки).
   * Haiku 5.5 и другие модели с рассуждениями тратят на них до 9 тыс. токенов, сама карточка — до 4 тыс.
   */
  LLM_MAX_TOKENS: z.coerce.number().int().min(1000).max(64000).default(16000).or(emptyToUndefined.transform(() => 16000)),
  /** Только anthropic: output_config.effort. */
  LLM_EFFORT: z.enum(["low", "medium", "high"]).optional().or(emptyToUndefined),
  /** Structured outputs поверх JSON-по-просьбе: auto — включено там, где известно, что работает. */
  LLM_STRUCTURED: z.enum(["auto", "on", "off"]).default("auto"),
});
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return LlmConfigSchema.parse(env);
}

export interface ModelOption {
  id: string;
  label: string;
}

export interface ModelList {
  default: string;
  models: ModelOption[];
}

/** Подписи известных моделей; неизвестные показываются по id. */
const KNOWN_MODELS: Record<string, { name: string; hint?: string }> = {
  "claude-sonnet-5-5": { name: "Claude Sonnet 5.5" },
  "claude-opus-5-5": { name: "Claude Opus 5.5", hint: "точнее, дороже" },
  "claude-haiku-5-5": { name: "Claude Haiku 5.5", hint: "быстрее, дешевле" },
};

function modelLabel(id: string, isDefault: boolean): string {
  const known = KNOWN_MODELS[id];
  if (!known) return id;
  if (isDefault) return `${known.name} — по умолчанию`;
  return known.hint ? `${known.name} — ${known.hint}` : known.name;
}

/** Доступные модели: LLM_MODEL первой, затем LLM_MODELS без повторов. */
export function listModels(cfg: LlmConfig): ModelList {
  const ids = [cfg.LLM_MODEL, ...(cfg.LLM_MODELS ?? "").split(",").map((m) => m.trim())].filter(Boolean);
  const unique = [...new Set(ids)];
  return {
    default: cfg.LLM_MODEL,
    models: unique.map((id) => ({ id, label: modelLabel(id, id === cfg.LLM_MODEL) })),
  };
}
