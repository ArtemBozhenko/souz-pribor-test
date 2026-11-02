/**
 * Общий контракт проекта. Единственный источник типов для ядра, сервера, веба и CLI.
 * Менять только через тикет каркаса (#1).
 */
import { z } from "zod";

/** Ровно это значение ставится в характеристику, которой нет во входе. */
export const NO_DATA = "данных нет";

export const ProductInputSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название товара"),
    manufacturer: z.string().trim().optional(),
    specs: z.record(z.string(), z.string()).optional(),
    description: z.string().optional(),
    model: z
      .string()
      .trim()
      .min(1, "Укажите модель или уберите поле model")
      .optional()
      .describe("Модель из GET /api/models; без поля — модель по умолчанию"),
  })
  .describe("Исходные данные о товаре");
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const SpecSchema = z
  .object({
    group: z.string().min(1),
    name: z.string().min(1),
    value: z.string(),
    unit: z.string().optional(),
    source: z.enum(["input", "missing"]),
    source_quote: z.string().optional(),
  })
  .superRefine((spec, ctx) => {
    if (spec.source === "input" && !spec.source_quote?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["source_quote"],
        message: "Для значения из входа нужна дословная цитата",
      });
    }
    if (spec.source === "missing" && spec.value !== NO_DATA) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Для отсутствующего значения допустимо только «${NO_DATA}»`,
      });
    }
  });
export type Spec = z.infer<typeof SpecSchema>;

export const AdvantageSchema = z.object({
  text: z.string().min(1),
  basis: z.string().min(1).describe("Поле входа, на котором основано преимущество"),
});

export const CommercialSchema = z.object({
  audience: z.array(z.string()),
  tasks: z.array(z.string()),
  advantages: z.array(AdvantageSchema),
  manager_questions: z.array(z.string()),
  limitations: z.array(z.string()),
});

export const MissingFieldSchema = z.object({ field: z.string(), reason: z.string() });
export const WarningSchema = z.object({ code: z.string(), message: z.string() });

export const CardMetaSchema = z.object({
  model: z.string(),
  provider: z.string(),
  attempts: z.number().int().nonnegative(),
  duration_ms: z.number().nonnegative(),
});

/**
 * Карточка товара. Длины SEO-полей и число поисковых запросов схема не режет:
 * их проверяет код ядра и сообщает через warnings.
 */
export const ProductCardSchema = z.object({
  seo_title: z.string().min(1),
  seo_description: z.string().min(1),
  specs: z.array(SpecSchema),
  search_queries: z.array(z.string()),
  commercial: CommercialSchema,
  missing_fields: z.array(MissingFieldSchema),
  warnings: z.array(WarningSchema),
  meta: CardMetaSchema,
});
export type ProductCard = z.infer<typeof ProductCardSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().describe("Сообщение по-русски"),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ModelOptionSchema = z.object({
  id: z.string().min(1).describe("Идентификатор модели у провайдера"),
  label: z.string().min(1).describe("Подпись для списка"),
});
export type ModelOption = z.infer<typeof ModelOptionSchema>;

export const ModelsResponseSchema = z
  .object({
    default: z.string().min(1).describe("Модель, которая берётся без поля model"),
    models: z.array(ModelOptionSchema).min(1),
  })
  .describe("Модели, доступные для генерации");
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;

export const HealthSchema = z.object({ ok: z.literal(true) });

/** Пределы, которые проверяет код ядра. */
export const LIMITS = {
  seoTitleMax: 70,
  seoDescriptionMin: 800,
  seoDescriptionMax: 1200,
  searchQueriesMin: 3,
  searchQueriesMax: 5,
} as const;
