/** Ядро: разбор и нормализация входа, тип прибора, шаблоны обязательных полей. */
import { ProductInputSchema, type ProductInput } from "../../contract";
import { CoreError } from "../errors";

export interface NormalizedInput {
  name: string;
  manufacturer?: string;
  specs: Array<{ key: string; value: string }>;
  description?: string;
}

export type DeviceType = "pressure_gauge" | "pressure_sensor" | "thermometer" | "other";

export const DEVICE_LABEL: Record<DeviceType, string> = {
  pressure_gauge: "манометр",
  pressure_sensor: "датчик давления",
  thermometer: "термометр",
  other: "прибор КИП",
};

/** Разбор сырого JSON. Ошибка содержит строку и столбец, если их можно вычислить. */
export function parseInputJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const m = /position (\d+)/.exec(msg);
    let where = "";
    if (m) {
      const pos = Number(m[1]);
      const before = raw.slice(0, pos);
      const line = before.split("\n").length;
      const col = pos - before.lastIndexOf("\n");
      where = ` (строка ${line}, столбец ${col})`;
    } else {
      const lc = /line (\d+) column (\d+)/.exec(msg);
      if (lc) where = ` (строка ${lc[1]}, столбец ${lc[2]})`;
    }
    throw new CoreError("invalid_json", `Входной файл — не корректный JSON${where}.`, { cause: err });
  }
}

const clean = (s: string | undefined): string | undefined => {
  if (s === undefined) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
};

/** Проверка по схеме контракта и нормализация: пробелы схлопнуты, пустые поля считаются отсутствующими. */
export function normalizeInput(data: unknown): NormalizedInput {
  const parsed = ProductInputSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new CoreError("invalid_input", `Некорректные входные данные: ${msg}`, { details: parsed.error.issues });
  }
  const input: ProductInput = parsed.data;
  const name = clean(input.name);
  if (!name) throw new CoreError("invalid_input", "Некорректные входные данные: Укажите название товара");
  const specs: NormalizedInput["specs"] = [];
  for (const [k, v] of Object.entries(input.specs ?? {})) {
    const key = clean(k);
    const value = clean(v);
    if (key && value) specs.push({ key, value });
  }
  const manufacturer = clean(input.manufacturer);
  const description = clean(input.description);
  return {
    name,
    ...(manufacturer ? { manufacturer } : {}),
    specs,
    ...(description ? { description } : {}),
  };
}

export function detectDeviceType(input: NormalizedInput): DeviceType {
  const text = `${input.name} ${input.description ?? ""}`.toLowerCase();
  if (/датчик давлени|преобразовател[ья] давлени|pressure (sensor|transmitter)/.test(text)) return "pressure_sensor";
  if (/мановакуумметр|вакуумметр|манометр|напоромер|тягомер/.test(text)) return "pressure_gauge";
  if (/термометр|термопреобразовател|термопар|thermometer/.test(text)) return "thermometer";
  return "other";
}

export interface RequiredField {
  /** Название характеристики в карточке. */
  name: string;
  group: string;
  /** Признаки, по которым поле узнаётся во входе (ключ или текст). */
  match: RegExp;
}

const COMMON: RequiredField[] = [
  { name: "Диапазон измерений", group: "Измерение", match: /диапазон|предел|шкал|\d\s*(?:\.\.\.|…|–|-)\s*\d/i },
  { name: "Класс точности / погрешность", group: "Измерение", match: /класс|погрешн|точност/i },
  { name: "Присоединение", group: "Конструкция", match: /присоедин|резьб|штуцер|\bG\s?\d|\bM\d+/i },
  { name: "Габариты", group: "Конструкция", match: /габарит|диаметр|размер|Ø|\d+\s*мм/i },
  { name: "Степень защиты (IP)", group: "Эксплуатация", match: /\bIP\s?\d{2}|степень защиты/i },
  { name: "Температура измеряемой среды", group: "Эксплуатация", match: /температур[аы]? (измеряемой |рабочей )?сред/i },
];

const OUTPUT_SIGNAL: RequiredField = {
  name: "Выходной сигнал",
  group: "Электрика",
  match: /выходн|сигнал|мА\b|HART|RS-?485|Modbus/i,
};

export const DEVICE_TEMPLATES: Record<DeviceType, RequiredField[]> = {
  pressure_gauge: [...COMMON, { name: "Диаметр корпуса", group: "Конструкция", match: /диаметр|корпус|Ø|\d+\s*мм/i }],
  pressure_sensor: [...COMMON, OUTPUT_SIGNAL, { name: "Напряжение питания", group: "Электрика", match: /питани|напряжени|\d\s*В\b/i }],
  thermometer: [
    ...COMMON.filter((f) => f.name !== "Температура измеряемой среды"),
    { name: "Длина погружной части", group: "Конструкция", match: /погружн|длин[аы]|гильз/i },
  ],
  other: [...COMMON, OUTPUT_SIGNAL],
};

/** Обязательные поля шаблона, которых нет во входе. */
export function findMissingFields(input: NormalizedInput, type: DeviceType): RequiredField[] {
  const corpus = [input.name, input.description ?? "", ...input.specs.map((s) => `${s.key}: ${s.value}`)].join("\n");
  return DEVICE_TEMPLATES[type].filter((f) => !f.match.test(corpus));
}

/** Весь текст входа одной строкой — по нему сверяются цитаты и числа. */
export function inputCorpus(input: NormalizedInput): string {
  return [input.name, input.manufacturer ?? "", ...input.specs.map((s) => `${s.key}: ${s.value}`), input.description ?? ""].join("\n");
}
