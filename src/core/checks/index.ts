/** Ядро: проверки ответа модели кодом. Сверка идёт только со входом, внешнего мира нет. */
import { LIMITS, NO_DATA, type Spec } from "../../contract";
import type { NormalizedInput } from "../input";

/** Ответ модели до добавления полей, которые заполняет код. */
export interface ModelCard {
  seo_title: string;
  seo_description: string;
  specs: Spec[];
  search_queries: string[];
  commercial: {
    audience: string[];
    tasks: string[];
    advantages: Array<{ text: string; basis: string }>;
    manager_questions: string[];
    limitations: string[];
  };
}

export type Violation =
  | { kind: "quote"; specIndex: number; message: string }
  | { kind: "spec_number"; specIndex: number; message: string }
  | { kind: "text_number"; field: string; message: string }
  | { kind: "length"; field: string; message: string };

/** Нормализация для сравнения: регистр, ё, тире, многоточия, десятичная запятая, пробелы. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\u00a0\u2009\u202f]/g, " ")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[«»"“”„]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Числа из текста в каноническом виде: «1,6» и «1.60» → «1.6», «010» → «10». */
export function extractNumbers(s: string): string[] {
  const out: string[] = [];
  for (const m of normalizeText(s).matchAll(/\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.push(String(n));
  }
  return out;
}

export interface InputIndex {
  text: string;
  numbers: Set<string>;
}

export function indexInput(corpus: string): InputIndex {
  return { text: normalizeText(corpus), numbers: new Set(extractNumbers(corpus)) };
}

function unknownNumbers(s: string, idx: InputIndex): string[] {
  return [...new Set(extractNumbers(s).filter((n) => !idx.numbers.has(n)))];
}

export function checkCard(card: ModelCard, idx: InputIndex): Violation[] {
  const v: Violation[] = [];

  card.specs.forEach((spec, i) => {
    if (spec.source !== "input") return;
    const quote = spec.source_quote?.trim() ?? "";
    if (!quote || !idx.text.includes(normalizeText(quote))) {
      v.push({ kind: "quote", specIndex: i, message: `Характеристика «${spec.name}»: цитата «${quote}» не найдена во входных данных.` });
      return;
    }
    const bad = unknownNumbers(`${spec.value} ${spec.unit ?? ""}`, idx);
    if (bad.length) {
      v.push({ kind: "spec_number", specIndex: i, message: `Характеристика «${spec.name}»: числа ${bad.join(", ")} отсутствуют во входных данных.` });
    }
  });

  const texts: Array<[string, string]> = [
    ["seo_title", card.seo_title],
    ["seo_description", card.seo_description],
    ...card.search_queries.map((q, i): [string, string] => [`search_queries[${i}]`, q]),
    ...card.commercial.advantages.map((a, i): [string, string] => [`commercial.advantages[${i}]`, a.text]),
    ...card.commercial.tasks.map((t, i): [string, string] => [`commercial.tasks[${i}]`, t]),
    ...card.commercial.limitations.map((t, i): [string, string] => [`commercial.limitations[${i}]`, t]),
  ];
  for (const [field, text] of texts) {
    const bad = unknownNumbers(text, idx);
    if (bad.length) v.push({ kind: "text_number", field, message: `Поле ${field}: числа ${bad.join(", ")} отсутствуют во входных данных.` });
  }

  const t = card.seo_title.length;
  if (t > LIMITS.seoTitleMax) {
    v.push({ kind: "length", field: "seo_title", message: `seo_title длиной ${t} символов, допустимо не больше ${LIMITS.seoTitleMax}.` });
  }
  const d = card.seo_description.length;
  if (d < LIMITS.seoDescriptionMin || d > LIMITS.seoDescriptionMax) {
    v.push({
      kind: "length",
      field: "seo_description",
      message: `seo_description длиной ${d} символов, нужно от ${LIMITS.seoDescriptionMin} до ${LIMITS.seoDescriptionMax}.`,
    });
  }
  const q = card.search_queries.length;
  if (q < LIMITS.searchQueriesMin || q > LIMITS.searchQueriesMax) {
    v.push({
      kind: "length",
      field: "search_queries",
      message: `Поисковых запросов ${q}, нужно от ${LIMITS.searchQueriesMin} до ${LIMITS.searchQueriesMax}.`,
    });
  }
  return v;
}

/** Неподтверждённые характеристики → «данных нет». Возвращает новую карточку. */
export function scrubUnverified(card: ModelCard, violations: Violation[]): ModelCard {
  const bad = new Set(violations.flatMap((x) => ("specIndex" in x ? [x.specIndex] : [])));
  return {
    ...card,
    specs: card.specs.map((s, i) => (bad.has(i) ? { group: s.group, name: s.name, value: NO_DATA, source: "missing" as const } : s)),
  };
}

/** Противоречия внутри входа: одно и то же свойство с разными значениями в характеристиках и описании. */
export function findInputContradictions(input: NormalizedInput): string[] {
  const out: string[] = [];
  const desc = input.description ?? "";
  const specText = input.specs.map((s) => s.value).join(" ");
  const ip = (s: string) => new Set([...s.matchAll(/\bIP\s?(\d{2})\b/gi)].map((m) => m[1]!));
  const a = ip(specText);
  const b = ip(desc);
  if (a.size && b.size && ![...a].some((x) => b.has(x))) {
    out.push(`Степень защиты расходится: в характеристиках IP${[...a].join("/")}, в описании IP${[...b].join("/")}.`);
  }
  const cls = (s: string) =>
    new Set([...normalizeText(s).matchAll(/класс(?:а)?(?: точности)?\s*(\d+(?:\.\d+)?)/g)].map((m) => String(Number(m[1]))));
  const specCls = new Set(
    input.specs.filter((s) => /класс|точност/i.test(s.key)).flatMap((s) => extractNumbers(s.value)),
  );
  const descCls = cls(desc);
  if (specCls.size && descCls.size && ![...specCls].some((x) => descCls.has(x))) {
    out.push(`Класс точности расходится: в характеристиках ${[...specCls].join("/")}, в описании ${[...descCls].join("/")}.`);
  }
  // Один и тот же ключ, записанный по-разному («Диаметр» и «диаметр »), с разными значениями.
  const byKey = new Map<string, string>();
  for (const s of input.specs) {
    const k = normalizeText(s.key);
    const prev = byKey.get(k);
    if (prev !== undefined && normalizeText(prev) !== normalizeText(s.value)) {
      out.push(`Характеристика «${s.key}» указана дважды с разными значениями: «${prev}» и «${s.value}».`);
    }
    byKey.set(k, s.value);
  }
  return out;
}
