import { describe, expect, it } from "vitest";
import { CoreError, generateCard, listModels, readLlmConfig, resolveModel } from "..";
import type { LlmConfig } from "../llm";
import { GAUGE_INPUT, fakeClient, goodCard } from "./helpers";

const ENV = {
  LLM_API_KEY: "k",
  LLM_MODEL: "claude-sonnet-5-5",
  LLM_MODELS: "claude-sonnet-5-5, claude-opus-5-5,claude-haiku-5-5,glm-4.5-flash",
};

describe("список моделей", () => {
  it("LLM_MODEL первой, LLM_MODELS без повторов, русские подписи для известных id", () => {
    expect(listModels(readLlmConfig(ENV))).toEqual({
      default: "claude-sonnet-5-5",
      models: [
        { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — по умолчанию" },
        { id: "claude-opus-5-5", label: "Claude Opus 5.5 — точнее, дороже" },
        { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — быстрее, дешевле" },
        { id: "glm-4.5-flash", label: "glm-4.5-flash" },
      ],
    });
  });

  it("без LLM_MODELS в списке только LLM_MODEL; модель по умолчанию добавляется, даже если её нет в LLM_MODELS", () => {
    expect(listModels(readLlmConfig({ LLM_MODEL: "glm-4.5-flash" })).models).toEqual([
      { id: "glm-4.5-flash", label: "glm-4.5-flash" },
    ]);
    const cfg = readLlmConfig({ LLM_MODEL: "claude-opus-5-5", LLM_MODELS: "claude-haiku-5-5" });
    expect(listModels(cfg).models.map((m) => m.id)).toEqual(["claude-opus-5-5", "claude-haiku-5-5"]);
    expect(listModels(cfg).models[0]!.label).toBe("Claude Opus 5.5 — по умолчанию");
  });

  it("неизвестная модель — unsupported_model (400) с русским сообщением, без подмены", () => {
    const err = (() => {
      try {
        resolveModel(readLlmConfig(ENV), "gpt-4o");
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(CoreError);
    expect((err as CoreError).code).toBe("unsupported_model");
    expect((err as CoreError).httpStatus).toBe(400);
    expect((err as CoreError).message).toMatch(/не поддерживается/);
  });
});

describe("выбранная модель доходит до клиента", () => {
  it("model из запроса уходит в настройки клиента и в meta.model", async () => {
    const seen: LlmConfig[] = [];
    const card = await generateCard(
      { ...GAUGE_INPUT, model: "claude-haiku-5-5" },
      {
        env: ENV,
        log: () => {},
        createClient: (cfg) => {
          seen.push(cfg);
          return Object.assign(fakeClient([goodCard()]), { model: cfg.LLM_MODEL });
        },
      },
    );
    expect(seen.map((c) => c.LLM_MODEL)).toEqual(["claude-haiku-5-5"]);
    expect(card.meta.model).toBe("claude-haiku-5-5");
  });

  it("без model — модель по умолчанию; без ключа заглушка показывает выбранную модель", async () => {
    const seen: string[] = [];
    await generateCard(GAUGE_INPUT, {
      env: ENV,
      log: () => {},
      createClient: (cfg) => {
        seen.push(cfg.LLM_MODEL);
        return fakeClient([goodCard()]);
      },
    });
    expect(seen).toEqual(["claude-sonnet-5-5"]);
    const stub = await generateCard({ name: "X", model: "claude-opus-5-5" }, { env: { ...ENV, LLM_API_KEY: "" } });
    expect(stub.meta).toMatchObject({ model: "claude-opus-5-5", provider: "stub" });
  });

  it("неизвестная модель не доходит до клиента", async () => {
    let called = false;
    await expect(
      generateCard({ name: "X", model: "gpt-4o" }, { env: ENV, createClient: () => ((called = true), null) }),
    ).rejects.toMatchObject({ code: "unsupported_model" });
    expect(called).toBe(false);
  });
});
