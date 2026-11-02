import { expect, test, type Page } from "@playwright/test";
import { NO_DATA, type ProductCard } from "../src/contract";
import { STUB_CARD } from "../src/core/stub-card";

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
  await generate(page);

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
  await expect(page.getByTestId("meta")).toContainText("Модель: stub");
});

test("копирование блока в буфер одним кликом", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.goto("/");
  await page.getByRole("button", { name: "Подставить пример" }).click();
  await generate(page);
  await page.getByRole("button", { name: "Копировать: SEO-заголовок" }).click();
  await expect(page.getByText("Скопировано: SEO-заголовок")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(STUB_CARD.seo_title);
  await page.getByRole("button", { name: "Копировать: Характеристики" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Диаметр корпуса: 100 мм");
});

test("счётчики краснеют вне нормы", async ({ page }) => {
  await mockCard(page, { ...STUB_CARD, seo_title: "М".repeat(71), seo_description: "Короткое описание." });
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveText("71/70");
  await expect(block(page, "SEO-заголовок").getByTestId("counter")).toHaveAttribute("data-invalid", "true");
  await expect(block(page, "SEO-описание").getByTestId("counter")).toHaveAttribute("data-invalid", "true");
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
  await page.goto("/");
  await page.getByLabel("Название").fill("Манометр");
  await generate(page);
  await expect(page.getByRole("status")).toContainText("Генерация карточки");
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
  const [md] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Скачать .md" }).click()]);
  expect(md.suggestedFilename()).toBe("card.md");
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
