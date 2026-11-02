import { expect, test } from "@playwright/test";
import { ProductCardSchema } from "../src/contract";

test("страница открывается", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Генератор карточек товара" })).toBeVisible();
});

test("заглушка API отвечает по схеме", async ({ request }) => {
  const res = await request.post("/api/generate", { data: { name: "Манометр МП-100" } });
  expect(res.status()).toBe(200);
  expect(ProductCardSchema.safeParse(await res.json()).success).toBe(true);
});
