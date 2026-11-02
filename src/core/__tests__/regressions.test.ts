/** Регрессии #12 на реальных входах из examples/ с подменённой моделью. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NO_DATA, type ProductInput } from "../../contract";
import { generateCard } from "..";
import { fakeClient } from "./helpers";

const quiet = { log: () => {} };
const example = (f: string): ProductInput =>
  JSON.parse(readFileSync(new URL(`../../../examples/${f}`, import.meta.url), "utf8")) as ProductInput;

// Описание без чисел: проверки длины проходят, числа не мешают.
const DESC = "Прибор предназначен для контроля давления на технологических линиях предприятий. ".repeat(11).trim();

function card(seo_title: string, specs: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    seo_title,
    seo_description: DESC,
    specs,
    search_queries: ["манометр", "датчик давления", "купить прибор"],
    commercial: { audience: ["Службы КИПиА"], tasks: [], advantages: [], manager_questions: [], limitations: [] },
  };
}

describe("#12: title не теряет десятичные запятые", () => {
  it("DM 02: «0–1,6 МПа» в title остаётся целым", async () => {
    const title = "Манометр показывающий DM 02 Манотомь 0–1,6 МПа, G1/2, 100 мм";
    const reply = card(title, [
      { group: "Измерение", name: "Диапазон измерений", value: "0–1,6", unit: "МПа", source: "input", source_quote: "0–1,6 МПа" },
    ]);
    const out = await generateCard(example("dm02.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.meta.attempts).toBe(1);
    expect(out.seo_title).toBe(title);
  });

  it("ПД100: модель «ПД100-ДИ1,0-111-0,5» в title остаётся целой", async () => {
    const title = "Преобразователь давления ОВЕН ПД100-ДИ1,0-111-0,5, 4–20 мА";
    const reply = card(title, [
      { group: "Электрика", name: "Выходной сигнал", value: "4–20", unit: "мА", source: "input", source_quote: "4–20 мА" },
    ]);
    const out = await generateCard(example("pd100.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.seo_title).toBe(title);
  });

  it("реальное нарушение в title по-прежнему вычищается, десятичная запятая не страдает", async () => {
    const reply = card("Манометр DM 02 Манотомь 0–1,6 МПа, 250 мм", []);
    const out = await generateCard(example("dm02.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.seo_title).toBe("Манометр DM 02 Манотомь 0–1,6 МПа");
    expect(out.warnings.some((w) => w.code === "unverified_text" && w.message.includes("seo_title"))).toBe(true);
  });
});

describe("#12: missing_fields сверяется с итоговыми характеристиками", () => {
  const TEMP = "Температура измеряемой среды";

  it("ТМ-520Р: поле найдено моделью с цитатой → не в missing_fields", async () => {
    const reply = card("Манометр виброустойчивый ТМ-520Р РОСМА", [
      { group: "Эксплуатация", name: TEMP, value: "до +150", unit: "°С", source: "input", source_quote: "до +150 °С (без заполнения)" },
    ]);
    const out = await generateCard(example("tm-520r.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.specs.find((s) => s.name === TEMP)!.source).toBe("input");
    expect(out.missing_fields.map((m) => m.field)).not.toContain(TEMP);
  });

  it("ТМ-520Р: цитата не подтверждена → поле в missing_fields", async () => {
    const reply = card("Манометр виброустойчивый ТМ-520Р РОСМА", [
      { group: "Эксплуатация", name: TEMP, value: "до +150", unit: "°С", source: "input", source_quote: "до +150 °С всегда" },
    ]);
    const out = await generateCard(example("tm-520r.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.specs.find((s) => s.name === TEMP)!.value).toBe(NO_DATA);
    expect(out.missing_fields.map((m) => m.field)).toContain(TEMP);
  });

  it("ТМ-520Р: модель поле не дала → поле в missing_fields и «данных нет»", async () => {
    const reply = card("Манометр виброустойчивый ТМ-520Р РОСМА", []);
    const out = await generateCard(example("tm-520r.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.specs.find((s) => s.name === TEMP)!.value).toBe(NO_DATA);
    expect(out.missing_fields.map((m) => m.field)).toContain(TEMP);
  });
});

describe("противоречия во входе", () => {
  it("ТМ-520Р: IP 54 в таблице, IP65 и IP54 в описании → warning input_contradiction", async () => {
    const reply = card("Манометр виброустойчивый ТМ-520Р РОСМА", []);
    const out = await generateCard(example("tm-520r.json"), { client: fakeClient([reply]), ...quiet });
    const w = out.warnings.find((x) => x.code === "input_contradiction" && x.message.includes("Степень защиты"));
    expect(w?.message).toMatch(/65/);
  });

  it("DM 02: IP нигде нет → предупреждения о степени защиты нет", async () => {
    const reply = card("Манометр показывающий DM 02 Манотомь", []);
    const out = await generateCard(example("dm02.json"), { client: fakeClient([reply]), ...quiet });
    expect(out.warnings.some((x) => x.code === "input_contradiction")).toBe(false);
  });
});
