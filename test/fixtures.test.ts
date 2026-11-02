import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProductInputSchema } from "../src/contract";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

/** Каждая фикстура набора и ожидаемый исход проверки по `ProductInput`. */
const EXPECTED: Record<string, "valid" | "invalid-json" | "invalid-schema"> = {
  "dm02.json": "valid",
  "products/tm-520r-full.json": "valid",
  "products/pd100-partial.json": "valid",
  "edge/broken-json.json": "invalid-json",
  "edge/empty-name.json": "invalid-schema",
  "edge/name-only.json": "valid",
  "edge/specs-vs-description-conflict.json": "valid",
  "edge/prompt-injection.json": "valid",
  "edge/specs-only-in-passport.json": "valid",
};

function listJsonFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listJsonFiles(path.join(dir, entry.name), rel);
    return entry.name.endsWith(".json") ? [rel] : [];
  });
}

function read(rel: string): string {
  return readFileSync(path.join(FIXTURES_DIR, rel), "utf8");
}

describe("фикстуры входа", () => {
  it("у каждого файла в fixtures/ есть ожидаемый исход", () => {
    expect(listJsonFiles(FIXTURES_DIR).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [rel, outcome] of Object.entries(EXPECTED)) {
    it(`${rel}: ${outcome}`, () => {
      const text = read(rel);
      if (outcome === "invalid-json") {
        expect(() => JSON.parse(text)).toThrow(SyntaxError);
        return;
      }
      const result = ProductInputSchema.safeParse(JSON.parse(text));
      expect(result.success).toBe(outcome === "valid");
    });
  }

  it("пустое название отклоняется с понятным сообщением", () => {
    const result = ProductInputSchema.safeParse(JSON.parse(read("edge/empty-name.json")));
    expect(result.error?.issues[0]?.message).toBe("Укажите название товара");
  });

  it("DM 02 совпадает с примером из ТЗ дословно", () => {
    const task = readFileSync(path.resolve(FIXTURES_DIR, "../docs/task.md"), "utf8");
    const example = task.match(/```json\n([\s\S]*?)\n```/)?.[1];
    expect(example).toBeDefined();
    expect(JSON.parse(read("dm02.json"))).toEqual(JSON.parse(example!));
  });

  it("в неполном товаре нет ключевых полей, которые должна отметить карточка", () => {
    const input = ProductInputSchema.parse(JSON.parse(read("products/pd100-partial.json")));
    const keys = Object.keys(input.specs ?? {}).join(" ");
    expect(keys).not.toMatch(/Степень защиты|Штуцер|Температура/);
  });
});
