import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ProductCardSchema } from "../contract";

const run = promisify(execFile);
const tsx = path.resolve("node_modules/.bin/tsx");
const cli = path.resolve("src/cli/generate.ts");
// Без ключа ядро отдаёт заглушку: проверяется контракт CLI, а не модель.
const env = { ...process.env, LLM_API_KEY: "" };

describe("CLI generate", () => {
  it("пишет рядом с входом .card.json и .card.md", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cli-"));
    const input = path.join(dir, "gauge.json");
    await writeFile(input, JSON.stringify({ name: "Манометр МП-100" }));
    await run(tsx, [cli, input], { env, cwd: dir });
    const card = JSON.parse(await readFile(path.join(dir, "gauge.card.json"), "utf8"));
    expect(ProductCardSchema.safeParse(card).success).toBe(true);
    const md = await readFile(path.join(dir, "gauge.card.md"), "utf8");
    expect(md).toContain("## Характеристики");
  }, 30_000);

  it("битый входной JSON → код 1 и русская ошибка с позицией", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cli-"));
    const input = path.join(dir, "bad.json");
    await writeFile(input, '{"name": ');
    const err = await run(tsx, [cli, input], { env, cwd: dir }).catch((e: { code: number; stderr: string }) => e);
    expect((err as { code: number }).code).toBe(1);
    expect((err as { stderr: string }).stderr).toMatch(/не корректный JSON/);
  }, 30_000);
});
