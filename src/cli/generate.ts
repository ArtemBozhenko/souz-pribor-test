/**
 * CLI: `npm run generate -- <input.json>` (или JSON на stdin) → карточка JSON в stdout.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { ProductInputSchema } from "../contract";
import { generateCard } from "../core";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const file = process.argv[2];
  const raw = file ? await readFile(file, "utf8") : process.stdin.isTTY ? "" : await readStdin();
  const json: unknown = raw.trim() ? JSON.parse(raw) : { name: "Манометр МП-100" };
  const parsed = ProductInputSchema.safeParse(json);
  if (!parsed.success) {
    console.error("Некорректные входные данные:", parsed.error.issues.map((i) => i.message).join("; "));
    process.exitCode = 1;
    return;
  }
  const card = await generateCard(parsed.data);
  process.stdout.write(JSON.stringify(card, null, 2) + "\n");
}

main().catch((err: unknown) => {
  console.error("Ошибка генерации:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
