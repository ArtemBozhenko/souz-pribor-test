import { expect, test, type Page } from "@playwright/test";
import { NO_DATA, type ProductCard } from "../src/contract";
import { STUB_CARD } from "../src/core/stub-card";
import { cardToMarkdown, commercialText, queriesText, specsText } from "../src/web/lib/card-text";
import { readFile } from "node:fs/promises";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const generate = (page: Page) => page.getByRole("button", { name: "Сгенерировать" }).click();
const block = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

async function mockCard(page: Page, card: ProductCard) {
  await page.route("**/api/generate", (route) => route.fulfill({ json: card }));
}

test("пустое состояние до генерации", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Заполните данные о приборе")).toBeVisible();
});

test("форма → карточка на заглушке: блоки, счётчики, «данных нет», уточнения, meta", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр МП-100");
  await page.getByLabel("Производитель").fill("Союз-Прибор");
  await page.getByLabel("Характеристика 1").fill("Диаметр корпуса");
  await page.getByLabel("Значение 1").fill("100 мм");
  await page.getByRole("button", { name: "Добавить строку" }).click();
  await expect(page.getByLabel("Характеристика 2")).toBeVisible();
  await page.getByLabel("Характеристика 2").fill("Класс точности");
  await page.getByLabel("Значение 2").fill("1,5");
  await page.getByLabel("Описание или текст паспорта").fill("Корпус 100 мм.");
  const req = page.waitForRequest("**/api/generate");
  await generate(page);
  expect((await req).postDataJSON()).toEqual({
    name: "Манометр МП-100",
    manufacturer: "Союз-Прибор",
    specs: { "Диаметр корпуса": "100 мм", "Класс точности": "1,5" },
    description: "Корпус 100 мм.",
  });

  for (const name of ["SEO-заголовок", "SEO-описание", "Характеристики", "Поисковые запросы", "Коммерческий блок"]) {
    await expect(block(page, name)).toBeVisible();
  }
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveText(`${STUB_CARD.seo_title.length}/70`);
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveAttribute("data-invalid", "false");
  await expect(block(page, "SEO-описание").getByTestId("counter")).toContainText("норма 800–1200");
  await expect(block(page, "Характеристики").getByTestId("no-data")).toHaveCount(2);
  await expect(block(page, "Характеристики").getByTestId("no-data").first()).toHaveText(NO_DATA);
  await expect(block(page, "Характеристики").getByText("100 мм")).toHaveAttribute("title", "Источник: «корпус 100 мм»");

  const issues = page.getByRole("region", { name: "Требует уточнения" });
  await expect(issues).toContainText("Класс точности");
  await expect(page.getByRole("region", { name: "Предупреждения" })).toContainText("заглушка");
  await expect(page.getByTestId("meta")).toHaveText("Модель: stub · Провайдер: stub · Попыток: 0 · Время: 0.0 с");

  await expect(block(page, "SEO-заголовок")).toContainText(STUB_CARD.seo_title);
  await expect(block(page, "SEO-описание")).toContainText(STUB_CARD.seo_description);
  for (const q of STUB_CARD.search_queries) await expect(block(page, "Поисковые запросы")).toContainText(q);
  const c = STUB_CARD.commercial;
  for (const t of [...c.audience, ...c.tasks, ...c.advantages.map((a) => a.text), ...c.manager_questions, ...c.limitations]) {
    await expect(block(page, "Коммерческий блок")).toContainText(t);
  }
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).not.toHaveClass(/text-destructive/);
  await expect(block(page, "Характеристики").getByTestId("no-data").first()).toHaveClass(/bg-amber-50/);
});

test("копирование блока в буфер одним кликом", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.goto("/");
  await page.getByRole("button", { name: "Подставить пример" }).click();
  await generate(page);
  await expectAllBlocksCopy(page);
});

test("копирование работает и без Clipboard API (http не на localhost)", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.addInitScript(() => Object.defineProperty(window, "isSecureContext", { value: false }));
  await page.goto("/");
  await page.getByRole("button", { name: "Подставить пример" }).click();
  await generate(page);
  await expectAllBlocksCopy(page);
});

async function expectAllBlocksCopy(page: Page) {
  const expected: [string, string][] = [
    ["SEO-заголовок", STUB_CARD.seo_title],
    ["SEO-описание", STUB_CARD.seo_description],
    ["Характеристики", specsText(STUB_CARD.specs)],
    ["Поисковые запросы", queriesText(STUB_CARD.search_queries)],
    ["Коммерческий блок", commercialText(STUB_CARD.commercial)],
  ];
  expect(specsText(STUB_CARD.specs)).toContain("Диаметр корпуса: 100 мм");
  expect(commercialText(STUB_CARD.commercial)).toContain(STUB_CARD.commercial.manager_questions[0]);
  for (const [name, text] of expected) {
    await page.getByRole("button", { name: `Копировать: ${name}` }).click();
    await expect(page.getByText(`Скопировано: ${name}`)).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  }
}

test("счётчики краснеют вне нормы", async ({ page }) => {
  await mockCard(page, { ...STUB_CARD, seo_title: "М".repeat(71), seo_description: "Короткое описание." });
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveText("71/70");
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveAttribute("data-invalid", "true");
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveClass(/text-destructive/);
  await expect(block(page, "SEO-описание").getByTestId("counter")).toHaveAttribute("data-invalid", "true");
  await expect(block(page, "SEO-описание").getByTestId("counter")).toHaveClass(/text-destructive/);
});

test("счётчик описания: 1200 — норма, 1201 — превышение", async ({ page }) => {
  let len = 1200;
  await page.route("**/api/generate", (route) => route.fulfill({ json: { ...STUB_CARD, seo_description: "о".repeat(len) } }));
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  const counter = block(page, "SEO-описание").getByTestId("counter");
  await expect(counter).toHaveText("1200 симв., норма 800–1200");
  await expect(counter).toHaveAttribute("data-invalid", "false");
  len = 1201;
  await generate(page);
  await expect(counter).toHaveText("1201 симв., норма 800–1200");
  await expect(counter).toHaveAttribute("data-invalid", "true");
});

test("вкладка JSON: валидный ввод уходит на API", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.getByLabel("JSON с данными").fill(JSON.stringify({ name: "Термометр ТБ-1" }));
  const req = page.waitForRequest("**/api/generate");
  await generate(page);
  expect((await req).postDataJSON()).toEqual({ name: "Термометр ТБ-1" });
  await expect(block(page, "SEO-заголовок")).toBeVisible();
});

test("невалидный JSON → понятная ошибка, запрос не уходит", async ({ page }) => {
  let called = false;
  await page.route("**/api/generate", (route) => {
    called = true;
    return route.continue();
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.getByLabel("JSON с данными").fill("{ name: ");
  await generate(page);
  await expect(page.getByRole("alert")).toContainText("JSON не разобран");
  await page.getByLabel("JSON с данными").fill('{"manufacturer":"x"}');
  await generate(page);
  await expect(page.getByRole("alert")).toContainText("название");
  expect(called).toBe(false);
});

test("пустая форма → ошибка про название", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  await expect(page.getByRole("alert")).toContainText("Укажите название товара");
});

test("ошибка API показывается по-русски, страница работает дальше", async ({ page }) => {
  await page.route("**/api/generate", (route) =>
    route.fulfill({ status: 504, json: { error: { code: "timeout", message: "Модель не ответила вовремя" } } }),
  );
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  await expect(page.getByRole("alert")).toContainText("Модель не ответила вовремя");

  await page.unroute("**/api/generate");
  await generate(page);
  await expect(block(page, "SEO-заголовок")).toBeVisible();
});

test("сервер недоступен → русское сообщение", async ({ page }) => {
  await page.route("**/api/generate", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  await expect(page.getByRole("alert")).toContainText("Сервер недоступен");
});

test("загрузка показывает прогресс", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/generate", async (route) => {
    await gate;
    await route.fulfill({ json: STUB_CARD });
  });
  await page.clock.install();
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  await expect(page.getByRole("status")).toContainText("Генерация карточки… 0 с");
  await page.clock.runFor(30_000);
  await expect(page.getByRole("status")).toContainText("Генерация карточки… 30 с");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByRole("button", { name: "Генерация…" })).toBeDisabled();
  release();
  await expect(block(page, "SEO-заголовок")).toBeVisible();
});

test("скачивание .json и .md", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Подставить пример" }).click();
  await generate(page);
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Скачать .json" }).click()]);
  expect(json.suggestedFilename()).toBe("card.json");
  expect(JSON.parse(await readFile(await json.path(), "utf8"))).toEqual(STUB_CARD);
  const [md] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Скачать .md" }).click()]);
  expect(md.suggestedFilename()).toBe("card.md");
  const mdText = await readFile(await md.path(), "utf8");
  expect(mdText).toBe(cardToMarkdown(STUB_CARD));
  expect(mdText).toContain(STUB_CARD.seo_description);
  expect(mdText).toContain("| Диаметр корпуса | 100 мм |");
});

test("ширина телефона: без горизонтальной прокрутки", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Подставить пример" }).click();
  await generate(page);
  await expect(block(page, "Характеристики")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("пример — реальный ТМ-520Р; на телефоне названия характеристик видны целиком", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Подставить пример" }).click();
  await expect(page.getByLabel("Название")).toHaveValue("Манометр виброустойчивый ТМ-520Р");
  const keys = page.getByLabel(/^Характеристика \d+$/);
  await expect(keys).toHaveCount(16);
  for (const key of await keys.all()) {
    const clipped = await key.evaluate((el: HTMLTextAreaElement) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 1);
    expect(clipped, await key.inputValue()).toBe(false);
  }
  // Многострочное значение не склеивается в одну строку.
  const multiline = page.getByLabel("Значение 3");
  await expect(multiline).toHaveValue("0 - 100;\n-0,1 - 0;\n-0,1 - 24;");
  expect(await multiline.evaluate((el: HTMLTextAreaElement) => el.scrollHeight > el.clientHeight + 1)).toBe(false);
});
