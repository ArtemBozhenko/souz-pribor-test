/**
 * Ядро (#2): адаптеры провайдеров.
 * anthropic — @anthropic-ai/sdk (/v1/messages), openai-compatible — openai (/chat/completions).
 */
export { readLlmConfig, type LlmConfig } from "./config";

export interface LlmClient {
  complete(request: { system: string; user: string }): Promise<string>;
}
