/**
 * Функция Vercel (сборка: buildCommand в `vercel.json` → esbuild → `dist/server/vercel.js`, его реэкспортирует `api/index.js`).
 * Это тот же Fastify-сервер, что и локально (`buildApp`), без раздачи статики —
 * статику Vite (dist/web) Vercel отдаёт сам. Все запросы /api/* переписываются сюда (vercel.json).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app";

const ready = buildApp({ logger: true }).then(async (app) => {
  await app.ready();
  return app;
});

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await ready;
  app.server.emit("request", req, res);
}
