import { Download } from "lucide-react";
import { LIMITS, type ProductCard } from "../../../contract";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/clipboard";
import { cardToMarkdown, commercialText, queriesText } from "@/lib/card-text";
import { BlockCard } from "./BlockCard";
import { Counter } from "./Counter";
import { IssuesPanel } from "./IssuesPanel";
import { SpecsBlock } from "./SpecsBlock";

export function ResultView({ card }: { card: ProductCard }) {
  const c = card.commercial;
  return (
    <div className="space-y-4" data-testid="result">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Карточка товара{card.warnings.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">черновик с предупреждениями</span>}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile("card.json", JSON.stringify(card, null, 2), "application/json")}
          >
            <Download className="size-4" /> Скачать .json
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile("card.md", cardToMarkdown(card), "text/markdown")}>
            <Download className="size-4" /> Скачать .md
          </Button>
        </div>
      </div>

      <IssuesPanel card={card} />

      <BlockCard
        title="SEO-заголовок"
        copy={card.seo_title}
        aside={<Counter length={card.seo_title.length} max={LIMITS.seoTitleMax} />}
      >
        <p className="text-sm">{card.seo_title}</p>
      </BlockCard>

      <BlockCard
        title="SEO-описание"
        copy={card.seo_description}
        aside={
          <Counter
            length={card.seo_description.length}
            min={LIMITS.seoDescriptionMin}
            max={LIMITS.seoDescriptionMax}
          />
        }
      >
        <p className="text-sm leading-relaxed whitespace-pre-line">{card.seo_description}</p>
      </BlockCard>

      <SpecsBlock specs={card.specs} />

      <BlockCard title="Поисковые запросы" copy={queriesText(card.search_queries)}>
        <ul className="flex flex-wrap gap-2 text-sm">
          {card.search_queries.map((q, i) => (
            <li key={i} className="rounded-md bg-muted px-2 py-1">
              {q}
            </li>
          ))}
        </ul>
      </BlockCard>

      <BlockCard title="Коммерческий блок" copy={commercialText(c)}>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <List title="Для кого" items={c.audience} />
          <List title="Задачи" items={c.tasks} />
          <List title="Преимущества" items={c.advantages.map((a) => a.text)} />
          <List title="Вопросы менеджеру" items={c.manager_questions} />
          <List title="Ограничения" items={c.limitations} />
        </div>
      </BlockCard>

      <footer className="text-xs text-muted-foreground" data-testid="meta">
        Модель: {card.meta.model} · Провайдер: {card.meta.provider} · Попыток: {card.meta.attempts} · Время:{" "}
        {(card.meta.duration_ms / 1000).toFixed(1)} с
      </footer>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-1 font-semibold">{title}</h4>
      {items.length ? (
        <ul className="list-disc space-y-0.5 pl-5">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}
