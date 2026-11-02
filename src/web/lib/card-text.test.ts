import { describe, expect, it } from "vitest";
import { STUB_CARD } from "../../core/stub-card";
import { cardToMarkdown, specsText } from "./card-text";

describe("текст карточки", () => {
  it("характеристики по группам, единица через пробел, «данных нет» без единицы", () => {
    const text = specsText(STUB_CARD.specs);
    expect(text).toContain("Конструкция\nДиаметр корпуса: 100 мм");
    expect(text).toContain("Класс точности: данных нет");
  });
  it("markdown содержит все блоки", () => {
    const md = cardToMarkdown(STUB_CARD);
    for (const h of ["# ", "## SEO-описание", "## Характеристики", "## Поисковые запросы", "## Вопросы менеджеру"]) {
      expect(md).toContain(h);
    }
  });
});
