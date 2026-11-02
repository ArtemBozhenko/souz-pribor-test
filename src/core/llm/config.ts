/** Настройки LLM из переменных окружения. Ключ не логируется. */
import { z } from "zod";

export const LlmConfigSchema = z.object({
  LLM_PROVIDER: z.enum(["anthropic", "openai-compatible"]).default("anthropic"),
  LLM_BASE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  LLM_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  LLM_API_KEY: z.string().optional(),
});
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return LlmConfigSchema.parse(env);
}
