import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { CoreError, mapProviderError, parseInputJson, renderMarkdown } from "..";
import { anthropicBaseUrl, createAnthropicClient, createOpenAiCompatibleClient, readLlmConfig } from "../llm";
import { detectDeviceType, findMissingFields, normalizeInput } from "../input";
import { STUB_CARD } from "../stub-card";

describe("вход", () => {
  it("битый JSON → ошибка с позицией", () => {
    const err = (() => {
      try {
        parseInputJson('{\n  "name": "x",\n  oops\n}');
      } catch (e) {
        return e;
      }
    })() as CoreError;
    expect(err.code).toBe("invalid_json");
    expect(err.message).toMatch(/строка 3, столбец \d+/);
  });

  it("пробельные поля считаются отсутствующими", () => {
    const n = normalizeInput({ name: "  Манометр  МП-100 ", manufacturer: " ", specs: { "Класс": "  ", " IP ": "IP54" } });
    expect(n).toEqual({ name: "Манометр МП-100", specs: [{ key: "IP", value: "IP54" }] });
  });

  it("тип прибора и недостающие поля шаблона", () => {
    const sensor = normalizeInput({ name: "Датчик давления ПД100", specs: { "Выходной сигнал": "4...20 мА" } });
    expect(detectDeviceType(sensor)).toBe("pressure_sensor");
    const missing = findMissingFields(sensor, "pressure_sensor").map((f) => f.name);
    expect(missing).toContain("Класс точности / погрешность");
    expect(missing).not.toContain("Выходной сигнал");
    expect(detectDeviceType(normalizeInput({ name: "Термометр ТБ-63" }))).toBe("thermometer");
  });
});

const sdkErr = (status: number) => Object.assign(new Error("provider text"), { status, requestID: "req_x" });

describe("маппинг ошибок API", () => {
  it.each([
    [401, "llm_auth", /Ключ API/],
    [403, "llm_auth", /Ключ API/],
    [429, "llm_rate_limit", /лимит запросов/],
    [500, "llm_unavailable", /временно недоступен/],
    [503, "llm_unavailable", /временно недоступен/],
    [529, "llm_overloaded", /перегружен/],
  ])("%i → %s с русским сообщением", (status, code, re) => {
    const e = mapProviderError(sdkErr(status));
    expect(e.code).toBe(code);
    expect(e.message).toMatch(re);
    expect(e.message).not.toContain("provider text");
    expect(e.requestId).toBe("req_x");
    expect(e.toApiError().error.code).toBe(code);
    expect(e.statusCode).toBeGreaterThanOrEqual(500);
  });

  it("таймаут Anthropic SDK → llm_timeout", async () => {
    const sdk = new Anthropic({ apiKey: "k", baseURL: "http://127.0.0.1:9", maxRetries: 0 });
    sdk.messages.create = (() => Promise.reject(new Anthropic.APIConnectionTimeoutError())) as never;
    const client = createAnthropicClient(readLlmConfig({ LLM_API_KEY: "k" }), sdk);
    await expect(client.complete({ system: "s", messages: [{ role: "user", content: "u" }] })).rejects.toMatchObject({
      code: "llm_timeout",
      message: expect.stringMatching(/Модель не ответила за отведённое время/),
    });
  });

  it("таймаут OpenAI SDK → llm_timeout", async () => {
    const sdk = new OpenAI({ apiKey: "k", baseURL: "http://127.0.0.1:9", maxRetries: 0 });
    sdk.chat.completions.create = (() => {
      const p = Promise.reject(new OpenAI.APIConnectionTimeoutError());
      return Object.assign(p, { withResponse: () => p });
    }) as never;
    const client = createOpenAiCompatibleClient(readLlmConfig({ LLM_API_KEY: "k", LLM_PROVIDER: "openai-compatible" }), sdk);
    await expect(client.complete({ system: "s", messages: [{ role: "user", content: "u" }] })).rejects.toMatchObject({
      code: "llm_timeout",
      message: expect.stringMatching(/Модель не ответила за отведённое время/),
    });
  });

  it("refusal и обрезка по токенам у anthropic → типизированные ошибки", async () => {
    for (const [stop, code] of [["refusal", "llm_refusal"], ["max_tokens", "llm_truncated"]] as const) {
      const sdk = new Anthropic({ apiKey: "k" });
      sdk.messages.create = (() => Promise.resolve({ stop_reason: stop, content: [] })) as never;
      const client = createAnthropicClient(readLlmConfig({ LLM_API_KEY: "k" }), sdk);
      await expect(client.complete({ system: "s", messages: [] })).rejects.toMatchObject({ code });
    }
  });

  it("max_tokens: лимит из LLM_MAX_TOKENS (по умолчанию 16000) уходит в запрос, обрыв — русское сообщение с моделью и лимитом", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const sdk = new Anthropic({ apiKey: "k" });
    sdk.messages.create = ((b: Record<string, unknown>) => {
      bodies.push(b);
      return Promise.resolve({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"seo_title": "обрыв' }] });
    }) as never;
    const env = { LLM_API_KEY: "k", LLM_MODEL: "claude-haiku-5-5" };
    const err = await createAnthropicClient(readLlmConfig(env), sdk)
      .complete({ system: "s", messages: [] })
      .catch((e: unknown) => e);
    expect(bodies[0]!.max_tokens).toBe(16000);
    expect(err).toMatchObject({
      code: "llm_truncated",
      httpStatus: 502,
      details: { model: "claude-haiku-5-5", max_tokens: 16000 },
    });
    expect((err as Error).message).toMatch(/claude-haiku-5-5 не уложилась в лимит ответа \(16000 токенов\).*LLM_MAX_TOKENS/);

    await createAnthropicClient(readLlmConfig({ ...env, LLM_MAX_TOKENS: "24000" }), sdk)
      .complete({ system: "s", messages: [] })
      .catch(() => {});
    expect(bodies[1]!.max_tokens).toBe(24000);
    expect(readLlmConfig({ LLM_MAX_TOKENS: "" }).LLM_MAX_TOKENS).toBe(16000);
    expect(() => readLlmConfig({ LLM_MAX_TOKENS: "10" })).toThrow();
  });

  it("openai-compatible: finish_reason=length → тот же llm_truncated, лимит из LLM_MAX_TOKENS", async () => {
    let body: Record<string, unknown> = {};
    const sdk = new OpenAI({ apiKey: "k" });
    sdk.chat.completions.create = ((b: Record<string, unknown>) => {
      body = b;
      const p = Promise.resolve({ data: { choices: [{ finish_reason: "length", message: { content: "{" } }] }, request_id: null });
      return { withResponse: () => p };
    }) as never;
    const cfg = readLlmConfig({ LLM_API_KEY: "k", LLM_PROVIDER: "openai-compatible", LLM_MODEL: "glm-4.5-flash", LLM_MAX_TOKENS: "12000" });
    await expect(createOpenAiCompatibleClient(cfg, sdk).complete({ system: "s", messages: [] })).rejects.toMatchObject({
      code: "llm_truncated",
      message: expect.stringMatching(/glm-4\.5-flash не уложилась в лимит ответа \(12000 токенов\)/),
    });
    expect(body.max_tokens).toBe(12000);
  });

  it("anthropic: без temperature, с output_config", async () => {
    let body: Record<string, unknown> = {};
    const sdk = new Anthropic({ apiKey: "k" });
    sdk.messages.create = ((b: Record<string, unknown>) => {
      body = b;
      return Promise.resolve({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] });
    }) as never;
    await createAnthropicClient(readLlmConfig({ LLM_API_KEY: "k", LLM_EFFORT: "low" }), sdk).complete({ system: "s", messages: [] });
    expect(body).not.toHaveProperty("temperature");
    expect(body.output_config).toMatchObject({ effort: "low", format: { type: "json_schema" } });
  });
});

describe("адрес Zen", () => {
  it("…/zen/v1 для anthropic превращается в …/zen (SDK сам добавит /v1/messages)", () => {
    expect(anthropicBaseUrl("https://opencode.ai/zen/v1")).toBe("https://opencode.ai/zen");
    expect(anthropicBaseUrl("https://opencode.ai/zen/v1/")).toBe("https://opencode.ai/zen");
    expect(anthropicBaseUrl(undefined)).toBeNull();
  });
});

describe("Markdown", () => {
  it("«данных нет» и предупреждения видны", () => {
    const md = renderMarkdown(STUB_CARD);
    expect(md).toContain("**данных нет**");
    expect(md).toContain("Требует уточнения");
    expect(md).toContain("## Характеристики");
  });
});
