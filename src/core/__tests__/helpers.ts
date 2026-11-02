import type { ChatMessage, LlmClient } from "../llm";

export const GAUGE_INPUT = {
  name: "Манометр показывающий ДМ 02",
  manufacturer: "Манотомь",
  specs: { "Диапазон измерений": "0–1,6 МПа", "Класс точности": "1,5", "Диаметр корпуса": "100 мм", "Присоединение": "G1/2" },
  description: "Для неагрессивных сред.",
};

const DESC_SENTENCE =
  "Манометр показывающий ДМ 02 от производителя Манотомь предназначен для местного контроля давления неагрессивных сред на технологических линиях. ";

export function goodCard(): Record<string, unknown> {
  return {
    seo_title: "Манометр показывающий ДМ 02 Манотомь 0–1,6 МПа, G1/2",
    seo_description: DESC_SENTENCE.repeat(7).trim(),
    specs: [
      { group: "Измерение", name: "Диапазон измерений", value: "0–1,6", unit: "МПа", source: "input", source_quote: "0–1,6 МПа" },
      { group: "Измерение", name: "Класс точности", value: "1,5", source: "input", source_quote: "Класс точности: 1,5" },
      { group: "Конструкция", name: "Диаметр корпуса", value: "100", unit: "мм", source: "input", source_quote: "100 мм" },
      { group: "Эксплуатация", name: "Степень защиты (IP)", value: "данных нет", source: "missing" },
    ],
    search_queries: ["манометр ДМ 02", "манометр 1,6 МПа", "ДМ 02 Манотомь", "купить манометр ДМ 02"],
    commercial: {
      audience: ["Службы КИПиА"],
      tasks: ["Контроль давления в трубопроводе"],
      advantages: [{ text: "Корпус 100 мм удобен для чтения показаний", basis: "Диаметр корпуса" }],
      manager_questions: ["Какая рабочая среда?"],
      limitations: ["Только неагрессивные среды"],
    },
  };
}

export type Reply = string | Record<string, unknown> | Error;

/** Подменённая модель: отдаёт ответы по очереди и запоминает запросы. */
export function fakeClient(replies: Reply[]): LlmClient & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  let i = 0;
  return {
    provider: "fake",
    model: "fake-model",
    calls,
    async complete({ messages }) {
      calls.push(structuredClone(messages));
      const r = replies[Math.min(i++, replies.length - 1)]!;
      if (r instanceof Error) throw r;
      return { text: typeof r === "string" ? r : JSON.stringify(r), requestId: `req_${i}` };
    },
  };
}
