/** Ядро: Markdown-карточка для контент-менеджера. «данных нет» и «требует уточнения» видны сразу. */
import { NO_DATA, type ProductCard } from "../../contract";

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const list = (items: string[]) => (items.length ? items.map((x) => `- ${x}`).join("\n") : `- ${NO_DATA}`);

export function renderMarkdown(card: ProductCard): string {
  const out: string[] = [];
  out.push(`# ${card.seo_title}`, "");
  if (card.warnings.length) {
    out.push("> **Требует уточнения перед публикацией:**");
    for (const w of card.warnings) out.push(`> - ${w.message}`);
    out.push("");
  }
  out.push(`**SEO-заголовок** (${card.seo_title.length} симв.): ${card.seo_title}`, "");
  out.push(`## Описание (${card.seo_description.length} симв.)`, "", card.seo_description, "");
  out.push("## Характеристики", "", "| Группа | Характеристика | Значение | Источник |", "|---|---|---|---|");
  for (const s of card.specs) {
    const value = s.source === "missing" ? `**${NO_DATA}**` : `${s.value}${s.unit ? ` ${s.unit}` : ""}`;
    const src = s.source === "input" ? `«${s.source_quote ?? ""}»` : "—";
    out.push(`| ${esc(s.group)} | ${esc(s.name)} | ${esc(value)} | ${esc(src)} |`);
  }
  out.push("");
  if (card.missing_fields.length) {
    out.push("## Недостающие данные", "");
    for (const m of card.missing_fields) out.push(`- **${m.field}** — ${m.reason}`);
    out.push("");
  }
  out.push("## Поисковые запросы", "", list(card.search_queries), "");
  const c = card.commercial;
  out.push("## Для менеджера", "");
  out.push("**Кому подходит**", "", list(c.audience), "");
  out.push("**Задачи**", "", list(c.tasks), "");
  out.push("**Преимущества**", "", list(c.advantages.map((a) => `${a.text} _(основание: ${a.basis})_`)), "");
  out.push("**Что уточнить у клиента**", "", list(c.manager_questions), "");
  out.push("**Ограничения**", "", list(c.limitations), "");
  out.push("---", `_Модель: ${card.meta.provider} / ${card.meta.model}, попыток: ${card.meta.attempts}, ${card.meta.duration_ms} мс._`, "");
  return out.join("\n");
}
