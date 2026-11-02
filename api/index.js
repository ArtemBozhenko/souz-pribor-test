// Функция Vercel. Сервер собирается esbuild-ом в buildCommand (vercel.json) из src/server/vercel.ts:
// Vercel не умеет ESM-импорты без расширений, которые используются в src.
export { default } from "../dist/server/vercel.js";
