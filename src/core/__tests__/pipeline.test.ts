import { describe, expect, it } from "vitest";
import { NO_DATA, ProductCardSchema } from "../../contract";
import { CoreError, generateCard } from "..";
import { GAUGE_INPUT, fakeClient, goodCard } from "./helpers";

const quiet = { log: () => {} };

describe("генерация с подменённой моделью", () => {
  it("корректный ответ с первой попытки → карточка без предупреждений о нарушениях", async () => {
    const client = fakeClient([goodCard()]);
    const card = await generateCard(GAUGE_INPUT, { client, ...quiet });
    expect(ProductCardSchema.safeParse(card).success).toBe(true);
    expect(card.meta.attempts).toBe(1);
    expect(card.warnings.filter((w) => w.code !== "input_contradiction")).toEqual([]);
    expect(card.missing_fields.map((m) => m.field)).toContain("Степень защиты (IP)");
  });

  it("выдуманное число в характеристике → «данных нет» и warning", async () => {
    const bad = goodCard();
    (bad.specs as Array<Record<string, unknown>>)[0] = {
      group: "Измерение", name: "Диапазон измерений", value: "0–2,5", unit: "МПа", source: "input", source_quote: "0–1,6 МПа",
    };
    const client = fakeClient([bad]);
    const card = await generateCard(GAUGE_INPUT, { client, ...quiet });
    expect(card.meta.attempts).toBe(3);
    const spec = card.specs.find((s) => s.name === "Диапазон измерений")!;
    expect(spec.value).toBe(NO_DATA);
    expect(spec.source).toBe("missing");
    expect(card.warnings.some((w) => w.code === "unverified_value" && w.message.includes("2.5"))).toBe(true);
  });

  it("цитата не из входа → «данных нет» и warning", async () => {
    const bad = goodCard();
    (bad.specs as Array<Record<string, unknown>>)[1] = {
      group: "Измерение", name: "Класс точности", value: "1,5", source: "input", source_quote: "класс 1,5 по ГОСТ",
    };
    const card = await generateCard(GAUGE_INPUT, { client: fakeClient([bad]), ...quiet });
    expect(card.specs.find((s) => s.name === "Класс точности")!.value).toBe(NO_DATA);
    expect(card.warnings.some((w) => w.code === "unverified_value" && w.message.includes("Класс точности"))).toBe(true);
  });

  it("длинный title → повтор, в промпте повтора текст ошибки", async () => {
    const long = { ...goodCard(), seo_title: "Манометр показывающий ДМ 02 Манотомь ".repeat(3) };
    const client = fakeClient([long, goodCard()]);
    const card = await generateCard(GAUGE_INPUT, { client, ...quiet });
    expect(card.meta.attempts).toBe(2);
    const repair = client.calls[1]!.at(-1)!;
    expect(repair.role).toBe("user");
    expect(repair.content).toMatch(/seo_title длиной \d+ символов, допустимо не больше 70/);
    expect(card.seo_title.length).toBeLessThanOrEqual(70);
  });

  it("3 провала подряд → черновик с warnings, а не ошибка", async () => {
    const long = { ...goodCard(), seo_title: "x".repeat(90) };
    const client = fakeClient([long, long, long]);
    const card = await generateCard(GAUGE_INPUT, { client, ...quiet });
    expect(client.calls).toHaveLength(3);
    expect(card.meta.attempts).toBe(3);
    expect(card.warnings.some((w) => w.code === "length" && w.message.includes("seo_title"))).toBe(true);
  });

  it("битый JSON модели → повтор с ошибкой разбора", async () => {
    const client = fakeClient(["{ это не json", goodCard()]);
    const card = await generateCard(GAUGE_INPUT, { client, ...quiet });
    expect(card.meta.attempts).toBe(2);
    expect(client.calls[1]!.at(-1)!.content).toMatch(/не корректный JSON|не содержит JSON/);
  });

  it("ответ в обёртке ```json разбирается", async () => {
    const client = fakeClient(["```json\n" + JSON.stringify(goodCard()) + "\n```"]);
    const card = await generateCard(GAUGE_INPUT, { client, ...quiet });
    expect(card.meta.attempts).toBe(1);
  });

  it("битый JSON во всех попытках → ошибка invalid_output", async () => {
    const client = fakeClient(["нет", "нет", "нет"]);
    await expect(generateCard(GAUGE_INPUT, { client, ...quiet })).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("выдуманное число в описании → warning «требует уточнения»", async () => {
    const bad = { ...goodCard() };
    bad.seo_description = (bad.seo_description as string) + " Срок службы 7 лет.";
    const card = await generateCard(GAUGE_INPUT, { client: fakeClient([bad]), ...quiet });
    expect(card.warnings.some((w) => w.code === "unverified_text" && w.message.includes("seo_description"))).toBe(true);
  });

  it("пустое name → понятная ошибка до вызова модели", async () => {
    const client = fakeClient([goodCard()]);
    const err = await generateCard({ ...GAUGE_INPUT, name: "   " }, { client, ...quiet }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CoreError);
    expect((err as CoreError).code).toBe("invalid_input");
    expect((err as CoreError).message).toMatch(/Укажите название товара/);
    expect(client.calls).toHaveLength(0);
  });

  it("противоречие во входе → warning input_contradiction", async () => {
    const input = { ...GAUGE_INPUT, specs: { ...GAUGE_INPUT.specs, "Степень защиты": "IP54" }, description: "Корпус IP65." };
    const card = await generateCard(input, { client: fakeClient([goodCard()]), ...quiet });
    expect(card.warnings.some((w) => w.code === "input_contradiction")).toBe(true);
  });

  it("без ключа и клиента → заглушка", async () => {
    const card = await generateCard(GAUGE_INPUT, { client: null });
    expect(card.meta.provider).toBe("stub");
  });
});
