/** Настройки LLM из переменных окружения. Ключ не логируется. */
import { z } from "zod";

const emptyToUndefined = z.literal("").transform(() => undefined);

export const LlmConfigSchema = z.object({
  LLM_PROVIDER: z.enum(["anthropic", "openai-compatible"]).default("anthropic"),
  LLM_BASE_URL: z.string().url().optional().or(emptyToUndefined),
  LLM_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  LLM_API_KEY: z.string().optional(),
  /** Только anthropic: output_config.effort. */
  LLM_EFFORT: z.enum(["low", "medium", "high"]).optional().or(emptyToUndefined),
  /** Structured outputs поверх JSON-по-просьбе: auto — включено там, где известно, что работает. */
  LLM_STRUCTURED: z.enum(["auto", "on", "off"]).default("auto"),
});
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return LlmConfigSchema.parse(env);
}
