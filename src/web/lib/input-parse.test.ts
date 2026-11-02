import { describe, expect, it } from "vitest";
import { EXAMPLE_INPUT, formToInput, inputToForm, parseJsonInput } from "./input-parse";

describe("ввод на клиенте", () => {
  it("битый JSON → понятная русская ошибка", () => {
    const r = parseJsonInput("{ name: ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON не разобран/);
  });
  it("JSON без названия → ошибка про поле «название»", () => {
    const r = parseJsonInput('{"manufacturer":"x"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/название/);
  });
  it("массив вместо объекта → ошибка", () => {
    expect(parseJsonInput("[]").ok).toBe(false);
  });
  it("пример проходит через форму без потерь", () => {
    const r = formToInput(inputToForm(EXAMPLE_INPUT));
    expect(r).toEqual({ ok: true, input: EXAMPLE_INPUT });
  });
  it("пустые строки характеристик отбрасываются, значение без названия — ошибка", () => {
    const base = { name: "Манометр", manufacturer: "", description: "" };
    expect(formToInput({ ...base, specs: [{ key: "", value: "" }] })).toEqual({ ok: true, input: { name: "Манометр" } });
    expect(formToInput({ ...base, specs: [{ key: "", value: "10" }] }).ok).toBe(false);
  });
});
