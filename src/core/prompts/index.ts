/**
 * Промпты ядра. Тексты — константы ниже, читаются без кода.
 * Порядок user-сообщения: <product_data> → <required_specs> → <instructions> → <example>.
 */
import { LIMITS, NO_DATA } from "../../contract";
import type { NormalizedInput, RequiredField } from "../input";

export const SYSTEM_PROMPT = `Ты — технический редактор интернет-магазина контрольно-измерительных приборов «Союз-Прибор».
Ты готовишь черновик карточки товара для контент-менеджера: SEO-заголовок, SEO-описание, характеристики, поисковые запросы и блок для менеджера по продажам.

Главное правило: используй только факты из <product_data>. Не добавляй характеристики, числа, стандарты, сертификаты, материалы и области применения, которых там нет, даже если они «типичны» для такого прибора.
Почему это важно: карточку читают инженеры и снабженцы и заказывают прибор по указанным параметрам. Выдуманный диапазон, класс точности или резьба приводят к поставке неподходящего прибора, возврату и потере доверия к магазину. Пропуск лучше ошибки.
Если характеристики нет во входе, ставь значение ровно «${NO_DATA}» и source = "missing". Для каждого значения из входа укажи source = "input" и source_quote — дословный фрагмент из <product_data>, откуда взято значение.

Пиши по-русски, деловым тоном, без восклицаний и маркетинговых превосходных степеней («лучший», «уникальный», «самый»). Без цен, скидок и сроков доставки. Между числом и единицей — пробел (100 мм, 1,6 МПа), единицы по ГОСТ 8.417.
Отвечай одним JSON-объектом без пояснений и без Markdown.`;

export const OUTPUT_FORMAT = `Формат ответа — JSON-объект:
{
  "seo_title": string,
  "seo_description": string,
  "specs": [{ "group": string, "name": string, "value": string, "unit"?: string, "source": "input" | "missing", "source_quote"?: string }],
  "search_queries": string[],
  "commercial": {
    "audience": string[],
    "tasks": string[],
    "advantages": [{ "text": string, "basis": string }],
    "manager_questions": string[],
    "limitations": string[]
  }
}`;

export const INSTRUCTIONS = `1. seo_title — не длиннее ${LIMITS.seoTitleMax} символов. Формула: тип прибора + модель + производитель + 1–3 ключевых параметра (диапазон, присоединение, диаметр или выходной сигнал). Не добавляй название магазина, слова «купить», «цена», «характеристики». Если параметра нет во входе — просто не включай его.
2. seo_description — от ${LIMITS.seoDescriptionMin} до ${LIMITS.seoDescriptionMax} символов, связный текст без списков. Порядок: назначение (тип и модель в первом предложении) → ключевые параметры словами → конструктив и польза для покупателя → области применения. Все числа — только из входа. Если важного параметра нет, напиши, что он уточняется при заказе.
3. specs — все характеристики из входа, сгруппированные (Измерение, Конструкция, Эксплуатация, Электрика, Прочее), и все поля из <required_specs>. Значение без единицы — в value, единица — в unit. Для отсутствующих: value = «${NO_DATA}», source = "missing", без source_quote.
4. search_queries — от ${LIMITS.searchQueriesMin} до ${LIMITS.searchQueriesMax} запросов, как их набирает покупатель: тип + модель; тип + ключевой параметр; модель + производитель; коммерческий запрос («купить …»). Без выдуманных параметров.
5. commercial — для менеджера: audience (кто покупает), tasks (какие задачи решает), advantages (каждое преимущество с basis — названием поля входа или «description», на котором оно основано), manager_questions (что уточнить у клиента, в первую очередь недостающие характеристики), limitations (ограничения применения, только если следуют из входа).`;

export const EXAMPLE = `<example>
Вход: {"name": "Термометр биметаллический ТБ-63", "manufacturer": "Пример-Прибор", "specs": {"Диапазон": "0...120 °C", "Длина погружной части": "64 мм"}}
Фрагмент ответа:
{"seo_title": "Термометр биметаллический ТБ-63 Пример-Прибор 0…120 °C, 64 мм",
 "specs": [
  {"group": "Измерение", "name": "Диапазон измерений", "value": "0...120", "unit": "°C", "source": "input", "source_quote": "0...120 °C"},
  {"group": "Измерение", "name": "Класс точности", "value": "${NO_DATA}", "source": "missing"}
 ],
 "commercial": {"advantages": [{"text": "Погружная часть 64 мм подходит для неглубоких гильз", "basis": "Длина погружной части"}]}}
Это другой прибор: из примера берётся только форма, не данные.
</example>`;

function productData(input: NormalizedInput): string {
  const lines = [`Название: ${input.name}`];
  if (input.manufacturer) lines.push(`Производитель: ${input.manufacturer}`);
  if (input.specs.length) {
    lines.push("Характеристики:");
    for (const s of input.specs) lines.push(`- ${s.key}: ${s.value}`);
  }
  if (input.description) lines.push(`Описание: ${input.description}`);
  return lines.join("\n");
}

export function buildUserPrompt(input: NormalizedInput, deviceLabel: string, required: RequiredField[], missing: RequiredField[]): string {
  const req = required
    .map((f) => `- ${f.name}${missing.includes(f) ? ` (во входе не найдено — «${NO_DATA}», если не найдёшь дословно)` : ""}`)
    .join("\n");
  return `<product_data>
${productData(input)}
</product_data>

<required_specs>
Тип прибора: ${deviceLabel}. Обязательные характеристики:
${req}
</required_specs>

<instructions>
${INSTRUCTIONS}

${OUTPUT_FORMAT}
</instructions>

${EXAMPLE}`;
}

/** Сообщение для повтора: перечень нарушений, найденных кодом. */
export function buildRepairPrompt(errors: string[]): string {
  return `Предыдущий ответ не прошёл проверку. Исправь ошибки и пришли полный JSON заново:
${errors.map((e) => `- ${e}`).join("\n")}
Напоминание: только факты из <product_data>; отсутствующее — «${NO_DATA}».`;
}
