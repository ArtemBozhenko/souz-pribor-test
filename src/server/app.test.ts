import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ApiErrorSchema, ProductCardSchema } from "../contract";
import { STUB_CARD } from "../core";
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
