/** Текстовые представления блоков карточки для копирования в CMS и выгрузки .md. */
import type { ProductCard, Spec } from "../../contract";

export function formatSpecValue(spec: Spec): string {
  return spec.unit && spec.source === "input" ? `${spec.value} ${spec.unit}` : spec.value;
}

export function groupSpecs(specs: Spec[]): [string, Spec[]][] {
  const groups = new Map<string, Spec[]>();
  for (const spec of specs) {
    const list = groups.get(spec.group) ?? [];
    list.push(spec);
    groups.set(spec.group, list);
  }
  return [...groups];
}

export function specsText(specs: Spec[]): string {
  return groupSpecs(specs)
    .map(([group, list]) => [group, ...list.map((s) => `${s.name}: ${formatSpecValue(s)}`)].join("\n"))
    .join("\n\n");
}

export function queriesText(queries: string[]): string {
  return queries.join("\n");
}

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function commercialText(c: ProductCard["commercial"]): string {
  return [
    `Для кого\n${list(c.audience)}`,
    `Задачи\n${list(c.tasks)}`,
    `Преимущества\n${list(c.advantages.map((a) => a.text))}`,
    `Вопросы менеджеру\n${list(c.manager_questions)}`,
    `Ограничения\n${list(c.limitations)}`,
  ].join("\n\n");
}

export function cardToMarkdown(card: ProductCard): string {
  const specs = groupSpecs(card.specs)
    .map(
      ([group, items]) =>
        `### ${group}\n\n| Характеристика | Значение |\n|---|---|\n` +
        items.map((s) => `| ${s.name} | ${formatSpecValue(s)} |`).join("\n"),
    )
    .join("\n\n");
  const c = card.commercial;
  return [
    `# ${card.seo_title}`,
    `## SEO-описание\n\n${card.seo_description}`,
    `## Характеристики\n\n${specs}`,
    `## Поисковые запросы\n\n${list(card.search_queries)}`,
    `## Для кого\n\n${list(c.audience)}`,
    `## Задачи\n\n${list(c.tasks)}`,
    `## Преимущества\n\n${list(c.advantages.map((a) => a.text))}`,
    `## Вопросы менеджеру\n\n${list(c.manager_questions)}`,
    `## Ограничения\n\n${list(c.limitations)}`,
  ].join("\n\n") + "\n";
}
