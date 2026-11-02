/**
 * CLI: `npm run generate -- [--model <id>] <input.json>` → рядом `<input>.card.json` и `<input>.card.md`.
 * `--model` — модель из списка LLM_MODELS (по умолчанию LLM_MODEL); вне списка — ошибка unsupported_model.
 * Без файла читает JSON со stdin и печатает карточку в stdout.
 * Ключ модели — только из env (LLM_API_KEY); без ключа отдаётся заглушка.
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductInput } from "../contract";
import { generateCard, isCoreError, normalizeInput, parseInputJson, renderMarkdown } from "../core";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function outputPaths(file: string): { json: string; md: string } {
  const dir = path.dirname(file);
  const base = path.basename(file, path.extname(file));
  return { json: path.join(dir, `${base}.card.json`), md: path.join(dir, `${base}.card.md`) };
}

const USAGE = "Использование: npm run generate -- [--model <id>] <input.json>";

function parseArgs(argv: string[]): { file?: string; model?: string } | null {
  let file: string | undefined;
  let model: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--model") {
      model = argv[++i];
      if (!model || model.startsWith("--")) return null;
    } else if (arg.startsWith("--model=")) {
      model = arg.slice("--model=".length);
      if (!model) return null;
    } else if (arg.startsWith("--") || file) {
      return null;
    } else {
      file = arg;
    }
  }
  return { ...(file ? { file } : {}), ...(model ? { model } : {}) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const { file, model } = args;
  if (!file && process.stdin.isTTY) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const raw = file ? await readFile(file, "utf8") : await readStdin();
  // Вход проверяется до вызова модели.
  const data = parseInputJson(raw);
  normalizeInput(data);
  const input = (model ? { ...(data as ProductInput), model } : data) as ProductInput;
  const card = await generateCard(input);
  const json = JSON.stringify(card, null, 2) + "\n";
  if (!file) {
    process.stdout.write(json);
    return;
  }
  const out = outputPaths(file);
  await writeFile(out.json, json, "utf8");
  await writeFile(out.md, renderMarkdown(card), "utf8");
  console.error(`Готово: ${out.json}, ${out.md}`);
  for (const w of card.warnings) console.error(`Предупреждение: ${w.message}`);
}

main().catch((err: unknown) => {
  if (isCoreError(err)) console.error(`Ошибка (${err.code}): ${err.message}`);
  else console.error("Ошибка генерации:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
