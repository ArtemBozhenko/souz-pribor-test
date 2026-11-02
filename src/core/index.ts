/**
 * Ядро (#2): общая точка входа для сервера и CLI.
 * Конвейер: input → prompts → llm → checks → render.
 * Пока возвращает статичную заглушку по контракту.
 */
import { ProductCardSchema, type ProductCard, type ProductInput } from "../contract";
import { STUB_CARD } from "./stub-card";

export type GenerateCard = (input: ProductInput) => Promise<ProductCard>;

export const generateCard: GenerateCard = async (_input) => {
  return ProductCardSchema.parse(structuredClone(STUB_CARD));
};

export { STUB_CARD };
