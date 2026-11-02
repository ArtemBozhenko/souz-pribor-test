/**
 * JSON Schema ответа модели для structured outputs. Только переносимые конструкции:
 * без min/max-ограничений (длины и количество проверяет код), additionalProperties: false.
 */
const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

export const MODEL_OUTPUT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["seo_title", "seo_description", "specs", "search_queries", "commercial"],
  properties: {
    seo_title: str,
    seo_description: str,
    specs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["group", "name", "value", "source"],
        properties: {
          group: str,
          name: str,
          value: str,
          unit: str,
          source: { type: "string", enum: ["input", "missing"] },
          source_quote: str,
        },
      },
    },
    search_queries: strArr,
    commercial: {
      type: "object",
      additionalProperties: false,
      required: ["audience", "tasks", "advantages", "manager_questions", "limitations"],
      properties: {
        audience: strArr,
        tasks: strArr,
        advantages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "basis"],
            properties: { text: str, basis: str },
          },
        },
        manager_questions: strArr,
        limitations: strArr,
      },
    },
  },
};
