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

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Есть ли во входе число n, за которым (через пробел или без) идёт единица. */
function numberWithUnit(text: string, n: string, unit: string): boolean {
  const re = new RegExp(`(^|[^\\d.])0*(\\d+(?:\\.\\d+)?)\\s?${escapeRe(unit)}`, "g");
  for (const m of text.matchAll(re)) if (String(Number(m[2])) === n) return true;
  return false;
}

/** Единицы, по которым ловится подмена «100 мм» → «100 МПа» (после normalizeText). */
const UNIT_RE = /(\d+(?:\.\d+)?)\s?(мпа|кпа|па|бар|кгс\/см2|кгс\/см²|мм рт\.? ?ст|мм|см|м|°c|°с|ма|мв|в|вт|ом|гц|%)(?![а-яa-z])/g;

/** Пары «число единица» из текста, которых нет во входе. */
function unknownPairs(s: string, idx: InputIndex): string[] {
  const out: string[] = [];
  for (const m of normalizeText(s).matchAll(UNIT_RE)) {
    const n = String(Number(m[1]));
    if (!numberWithUnit(idx.text, n, m[2]!)) out.push(`${n} ${m[2]}`);
  }
  return out;
}

function unknownNumbers(s: string, idx: InputIndex): string[] {
  const nums = extractNumbers(s).filter((n) => !idx.numbers.has(n));
  return [...new Set([...nums, ...unknownPairs(s, idx)])];
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
      return;
    }
    // Число и единица должны стоять во входе вместе: «100 мм» не подтверждает «100 МПа».
    const unit = spec.unit?.trim();
    const nums = extractNumbers(spec.value);
    const last = nums.at(-1);
    if (unit && last !== undefined && !numberWithUnit(idx.text, last, normalizeText(unit)) && !unknownPairs(spec.value, idx).length) {
      v.push({
        kind: "spec_number",
        specIndex: i,
        message: `Характеристика «${spec.name}»: во входных данных нет значения «${last} ${unit}».`,
      });
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

/**
 * Убирает неподтверждённое: характеристика → «данных нет»; в описании выбрасывается предложение
 * с выдуманным числом; в title — фрагмент между запятыми; в списках — весь пункт.
 */
export function scrubUnverified(card: ModelCard, violations: Violation[], idx: InputIndex, fallbackTitle: string): ModelCard {
  const bad = new Set(violations.flatMap((x) => ("specIndex" in x ? [x.specIndex] : [])));
  const ok = (t: string) => unknownNumbers(t, idx).length === 0;
  const sentences = card.seo_description.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [card.seo_description];
  // Title чистится только при нарушении в нём самом. Запятая между цифрами («1,6 МПа», «ДИ1,0-111») — не граница фрагмента.
  const titleBad = violations.some((x) => "field" in x && x.field === "seo_title" && x.kind === "text_number");
  const title = titleBad
    ? card.seo_title.split(/(?=(?<!\d),|,(?!\d))|(?<=—)/).filter(ok).join("").replace(/[,\s—]+$/, "").trim()
    : card.seo_title;
  return {
    seo_title: title || fallbackTitle,
    seo_description: sentences.filter(ok).join("").trim() || NO_DATA,
    specs: card.specs.map((s, i) => (bad.has(i) ? { group: s.group, name: s.name, value: NO_DATA, source: "missing" as const } : s)),
    search_queries: card.search_queries.filter(ok),
    commercial: {
      ...card.commercial,
      tasks: card.commercial.tasks.filter(ok),
      limitations: card.commercial.limitations.filter(ok),
      advantages: card.commercial.advantages.filter((a) => ok(a.text)),
    },
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
  // Расхождение — любые два разных IP во входе, даже если одно из значений совпало (ТМ-520Р: IP54 в таблице, IP65 и IP54 в описании).
  if (a.size && b.size && new Set([...a, ...b]).size > 1) {
    out.push(`Степень защиты расходится: в характеристиках ${[...a].map((x) => `IP${x}`).join(", ")}, в описании ${[...b].map((x) => `IP${x}`).join(", ")}.`);
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
