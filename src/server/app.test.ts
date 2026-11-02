import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ApiErrorSchema, ProductCardSchema } from "../contract";
import { STUB_CARD, generateCard } from "../core";
import { buildApp } from "./app";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe("API", () => {
  it("GET /api/health → { ok: true }", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("POST /api/generate возвращает карточку по схеме", async () => {
    const res = await app.inject({ method: "POST", url: "/api/generate", payload: { name: "Манометр МП-100" } });
    expect(res.statusCode).toBe(200);
    expect(ProductCardSchema.safeParse(res.json()).success).toBe(true);
  });

  it("невалидный вход → 400 с ApiError по-русски", async () => {
    const res = await app.inject({ method: "POST", url: "/api/generate", payload: { manufacturer: "x" } });
    expect(res.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toMatch(/[а-яё]/i);
  });

  it("не-JSON тело → 400 с ApiError", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/generate",
      payload: "{oops",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
    expect(ApiErrorSchema.safeParse(res.json()).success).toBe(true);
  });

  it("ответ ядра вне схемы → 500 с ApiError, а не битая карточка", async () => {
    const broken = await buildApp({
      generate: async () => ({ ...STUB_CARD, specs: [{ ...STUB_CARD.specs[0]!, source_quote: undefined }] }),
    });
    const res = await broken.inject({ method: "POST", url: "/api/generate", payload: { name: "X" } });
    await broken.close();
    expect(res.statusCode).toBe(500);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("invalid_output");
  });

  it("Swagger UI и OpenAPI доступны", async () => {
    const ui = await app.inject({ method: "GET", url: "/api/docs/" });
    expect(ui.statusCode).toBe(200);
    const spec = await app.inject({ method: "GET", url: "/api/docs/json" });
    expect(spec.json().paths).toHaveProperty("/api/generate");
  });
});

describe("ошибки ядра → ApiError с HTTP-кодом по смыслу", () => {
  const cases: [string, Record<string, unknown>, number][] = [
    ["таймаут модели", { code: "timeout", message: "Модель не ответила за 60 с" }, 504],
    ["нет ключа", { code: "no_api_key", message: "Не задан ключ LLM" }, 503],
    ["неподдержанный вход", { code: "unsupported", message: "Вход не поддерживается" }, 422],
    ["явный statusCode", { code: "something", message: "Что-то", statusCode: 429 }, 429],
  ];
  for (const [title, error, status] of cases) {
    it(title, async () => {
      const app = await buildApp({ generate: async () => { throw Object.assign(new Error(), error); } });
      const res = await app.inject({ method: "POST", url: "/api/generate", payload: { name: "X" } });
      await app.close();
      expect(res.statusCode).toBe(status);
      const body = ApiErrorSchema.parse(res.json());
      expect(body.error.code).toBe(error.code);
      expect(body.error.message).toBe(error.message);
    });
  }

  it("английское сообщение ядра заменяется русским", async () => {
    const app = await buildApp({
      generate: async () => { throw Object.assign(new Error("upstream 502"), { code: "llm_unavailable" }); },
    });
    const res = await app.inject({ method: "POST", url: "/api/generate", payload: { name: "X" } });
    await app.close();
    expect(res.statusCode).toBe(502);
    expect(ApiErrorSchema.parse(res.json()).error.message).toMatch(/[а-яё]/i);
  });

  it("неизвестная ошибка → 500 internal без деталей", async () => {
    const app = await buildApp({ generate: async () => { throw new Error("secret stack"); } });
    const res = await app.inject({ method: "POST", url: "/api/generate", payload: { name: "X" } });
    await app.close();
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("secret");
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("internal");
  });
});

describe("выбор модели", () => {
  const env = { LLM_API_KEY: "", LLM_MODEL: "claude-sonnet-5-5", LLM_MODELS: "claude-sonnet-5-5,claude-haiku-5-5" };

  it("GET /api/models отдаёт модель по умолчанию и список с подписями", async () => {
    const app = await buildApp({ env });
    const res = await app.inject({ method: "GET", url: "/api/models" });
    const spec = await app.inject({ method: "GET", url: "/api/docs/json" });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      default: "claude-sonnet-5-5",
      models: [
        { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — по умолчанию" },
        { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — быстрее, дешевле" },
      ],
    });
    const schema = spec.json().paths["/api/models"].get.responses["200"].content["application/json"].schema;
    expect(schema.required).toEqual(expect.arrayContaining(["default", "models"]));
    expect(schema.properties.models.items.required).toEqual(expect.arrayContaining(["id", "label"]));
  });

  it("model из тела доходит до клиента LLM, неизвестная — 400 unsupported_model", async () => {
    const seen: string[] = [];
    const app = await buildApp({
      env,
      generate: (input) =>
        generateCard(input, {
          env,
          createClient: (cfg) => {
            seen.push(cfg.LLM_MODEL);
            return null;
          },
        }),
    });
    const ok = await app.inject({ method: "POST", url: "/api/generate", payload: { name: "X", model: "claude-haiku-5-5" } });
    const bad = await app.inject({ method: "POST", url: "/api/generate", payload: { name: "X", model: "gpt-4o" } });
    await app.close();
    expect(ok.statusCode).toBe(200);
    expect(seen).toEqual(["claude-haiku-5-5"]);
    expect(ok.json().meta.model).toBe("claude-haiku-5-5");
    expect(bad.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(bad.json());
    expect(body.error.code).toBe("unsupported_model");
    expect(body.error.message).toMatch(/[а-яё]/i);
  });
});
