/** Конвейер генерации: вход → промпт → модель → проверки → повторы → карточка. */
import { z } from "zod";
import { CommercialSchema, NO_DATA, ProductCardSchema, SpecSchema, type ProductCard } from "../../contract";
import { checkCard, findInputContradictions, indexInput, normalizeText, scrubUnverified, type ModelCard, type Violation } from "../checks";
import { CoreError } from "../errors";
import { DEVICE_LABEL, DEVICE_TEMPLATES, detectDeviceType, findMissingFields, inputCorpus, normalizeInput } from "../input";
import type { ChatMessage, LlmClient } from "../llm";
import { SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from "../prompts";

/** Повторов после первой попытки. */
export const MAX_REPAIRS = 2;

const ModelOutputSchema = z.object({
  seo_title: z.string().trim().min(1),
  seo_description: z.string().trim().min(1),
  specs: z.array(SpecSchema),
  search_queries: z.array(z.string()),
  commercial: CommercialSchema,
});

export interface GenerateDeps {
  client: LlmClient;
  /** Куда писать request_id и ход повторов. По умолчанию — stderr. */
  log?: (message: string) => void;
  now?: () => number;
}

/** Достаёт JSON из ответа: допускает обёртку ```json и текст вокруг объекта. */
export function parseModelJson(text: string): { ok: true; card: ModelCard } | { ok: false; error: string } {
  let raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: "Ответ не содержит JSON-объекта." };
  raw = raw.slice(start, end + 1);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Ответ — не корректный JSON: ${err instanceof Error ? err.message : String(err)}.` };
  }
  // Мягкая нормализация: у отсутствующего значения текст всегда ровно NO_DATA.
  const specs = (data as { specs?: unknown }).specs;
  if (Array.isArray(specs)) {
    for (const s of specs as Array<Record<string, unknown>>) {
      if (s && s.source === "missing") {
        s.value = NO_DATA;
        delete s.source_quote;
      }
      if (s && s.unit === "") delete s.unit;
    }
  }
  const parsed = ModelOutputSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(корень)"}: ${i.message}`).join("; ");
    return { ok: false, error: `JSON не соответствует формату: ${issues}.` };
  }
  return { ok: true, card: parsed.data };
}

export async function runPipeline(rawInput: unknown, deps: GenerateDeps): Promise<ProductCard> {
  const log = deps.log ?? ((m: string) => console.error(m));
  const now = deps.now ?? Date.now;
  const started = now();

  const input = normalizeInput(rawInput);
  const type = detectDeviceType(input);
  const required = DEVICE_TEMPLATES[type];
  const missing = findMissingFields(input, type);
  const idx = indexInput(inputCorpus(input));

  const messages: ChatMessage[] = [{ role: "user", content: buildUserPrompt(input, DEVICE_LABEL[type], required, missing) }];
  let card: ModelCard | null = null;
  let violations: Violation[] = [];
  let attempts = 0;
  let lastParseError = "";

  for (let i = 0; i <= MAX_REPAIRS; i++) {
    attempts++;
    let res;
    try {
      res = await deps.client.complete({ system: SYSTEM_PROMPT, messages });
    } catch (err) {
      if (err instanceof CoreError && err.requestId) log(`LLM ошибка ${err.code}, request_id=${err.requestId}`);
      throw err;
    }
    const parsed = parseModelJson(res.text);
    let errors: string[];
    if (!parsed.ok) {
      lastParseError = parsed.error;
      errors = [parsed.error];
    } else {
      card = parsed.card;
      violations = checkCard(card, idx);
      if (!violations.length) break;
      errors = violations.map((v) => v.message);
    }
    if (i < MAX_REPAIRS) {
      log(`Попытка ${attempts}: ${errors.length} нарушений, повтор${res.requestId ? ` (request_id=${res.requestId})` : ""}`);
      messages.push({ role: "assistant", content: res.text }, { role: "user", content: buildRepairPrompt(errors) });
    }
  }

  if (!card) {
    throw new CoreError("invalid_output", "Модель не вернула карточку в нужном формате после повторов.", {
      details: lastParseError,
    });
  }
  // Ответ последней попытки мог не разобраться: тогда берём последнюю разобранную карточку и её нарушения.
  const final = scrubUnverified(card, violations);
  const warnings: ProductCard["warnings"] = [];
  for (const v of violations) {
    if (v.kind === "quote" || v.kind === "spec_number") {
      warnings.push({ code: "unverified_value", message: `${v.message} Значение заменено на «${NO_DATA}».` });
    } else if (v.kind === "text_number") {
      warnings.push({ code: "unverified_text", message: `${v.message} Требует уточнения перед публикацией.` });
    } else {
      warnings.push({ code: "length", message: v.message });
    }
  }
  for (const c of findInputContradictions(input)) warnings.push({ code: "input_contradiction", message: c });

  // Обязательные поля шаблона, которых нет во входе, обязательно видны в карточке.
  const names = new Set(final.specs.map((s) => normalizeText(s.name)));
  for (const f of missing) {
    if (!names.has(normalizeText(f.name))) final.specs.push({ group: f.group, name: f.name, value: NO_DATA, source: "missing" });
  }
  const missingFields = new Map<string, string>();
  for (const f of missing) missingFields.set(f.name, "Нет во входных данных");
  for (const s of final.specs) {
    if (s.source === "missing" && !missingFields.has(s.name)) missingFields.set(s.name, "Нет во входных данных или не подтверждено");
  }

  return ProductCardSchema.parse({
    ...final,
    missing_fields: [...missingFields].map(([field, reason]) => ({ field, reason })),
    warnings,
    meta: { model: deps.client.model, provider: deps.client.provider, attempts, duration_ms: Math.max(0, now() - started) },
  });
}
