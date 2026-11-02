import { describe, expect, it } from "vitest";
import { LIMITS, NO_DATA, ProductCardSchema, ProductInputSchema, SpecSchema } from "./schemas";
import { STUB_CARD } from "../core/stub-card";

describe("контракт", () => {
  it("заглушка ProductCard проходит схему", () => {
    expect(ProductCardSchema.safeParse(STUB_CARD).success).toBe(true);
  });

  it("вход без названия отклоняется", () => {
    expect(ProductInputSchema.safeParse({ manufacturer: "Союз-Прибор" }).success).toBe(false);
    expect(ProductInputSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("значение из входа требует дословной цитаты", () => {
    const spec = { group: "Измерение", name: "Класс точности", value: "1,5", source: "input" };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
    expect(SpecSchema.safeParse({ ...spec, source_quote: "класс точности 1,5" }).success).toBe(true);
  });

  it("отсутствующее значение — ровно «данных нет»", () => {
    const spec = { group: "Измерение", name: "Диапазон", source: "missing" };
    expect(SpecSchema.safeParse({ ...spec, value: "0–1 МПа" }).success).toBe(false);
    expect(SpecSchema.safeParse({ ...spec, value: NO_DATA }).success).toBe(true);
  });
});

describe("статичный пример карточки укладывается в пределы контракта", () => {
  it("seo_title ≤ 70, seo_description 800–1200, 3–5 запросов в нижнем регистре", () => {
    expect(STUB_CARD.seo_title.length).toBeLessThanOrEqual(LIMITS.seoTitleMax);
    expect(STUB_CARD.seo_description.length).toBeGreaterThanOrEqual(LIMITS.seoDescriptionMin);
    expect(STUB_CARD.seo_description.length).toBeLessThanOrEqual(LIMITS.seoDescriptionMax);
    expect(STUB_CARD.search_queries.length).toBeGreaterThanOrEqual(LIMITS.searchQueriesMin);
    expect(STUB_CARD.search_queries.length).toBeLessThanOrEqual(LIMITS.searchQueriesMax);
    for (const q of STUB_CARD.search_queries) expect(q).toBe(q.toLowerCase());
  });
});
