/** Разбор и проверка ввода на клиенте; ошибки — по-русски. */
import { ProductInputSchema, type ProductInput } from "../../contract";

export type ParseResult = { ok: true; input: ProductInput } | { ok: false; error: string };

const FIELD_NAMES: Record<string, string> = {
  name: "название",
  manufacturer: "производитель",
  specs: "характеристики",
  description: "описание",
};

export function validateInput(value: unknown): ParseResult {
  const parsed = ProductInputSchema.safeParse(value);
  if (parsed.success) return { ok: true, input: parsed.data };
  const messages = parsed.error.issues.map((issue) => {
    const [head, ...rest] = issue.path.map(String);
    const field = head ? (FIELD_NAMES[head] ?? head) + (rest.length ? ` → ${rest.join(" → ")}` : "") : "";
    const text = /[а-яё]/i.test(issue.message) ? issue.message : "неверный тип значения";
    return field ? `Поле «${field}»: ${text}` : text;
  });
  return { ok: false, error: messages.join("; ") };
}

export function parseJsonInput(text: string): ParseResult {
  if (!text.trim()) return { ok: false, error: "Вставьте JSON с данными о товаре" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "";
    return { ok: false, error: `JSON не разобран: проверьте кавычки, запятые и скобки. ${detail}`.trim() };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Ожидается JSON-объект с полями name, manufacturer, specs, description" };
  }
  return validateInput(value);
}

export interface SpecRow {
  key: string;
  value: string;
}

export interface FormValues {
  name: string;
  manufacturer: string;
  specs: SpecRow[];
  description: string;
}

export function formToInput(form: FormValues): ParseResult {
  const specs: Record<string, string> = {};
  for (const row of form.specs) {
    const key = row.key.trim();
    if (!key && !row.value.trim()) continue;
    if (!key) return { ok: false, error: "У характеристики со значением не указано название" };
    specs[key] = row.value.trim();
  }
  return validateInput({
    name: form.name,
    manufacturer: form.manufacturer.trim() || undefined,
    specs: Object.keys(specs).length ? specs : undefined,
    description: form.description.trim() || undefined,
  });
}

export const EXAMPLE_INPUT: ProductInput = {
  name: "Манометр показывающий МП-100",
  manufacturer: "Союз-Прибор",
  specs: {
    "Диаметр корпуса": "100 мм",
    "Присоединение": "М20×1,5, радиальное",
    "Рабочая среда": "жидкости, газы, пары",
  },
  description:
    "Манометр для измерения избыточного давления неагрессивных к медным сплавам сред. Корпус 100 мм, трубчатая пружина.",
};

export function inputToForm(input: ProductInput): FormValues {
  const specs = Object.entries(input.specs ?? {}).map(([key, value]) => ({ key, value }));
  return {
    name: input.name,
    manufacturer: input.manufacturer ?? "",
    specs: specs.length ? specs : [{ key: "", value: "" }],
    description: input.description ?? "",
  };
}
