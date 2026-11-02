# souz-pribor-test

Тестовое задание Союз-Прибор: AI-помощник для товарных описаний. Условие: [docs/task.md](docs/task.md).

## Запуск

Нужен Node.js 22 или новее.

```bash
npm i
cp .env.example .env
npm run dev        # Vite на :5173, API Fastify на :3000, /api проксируется
```

- `npm start` — собрать фронт и отдать его из Fastify одним процессом (:3000).
- `npm run generate -- input.json` — CLI: карточка JSON в stdout.
- Swagger UI: `/api/docs`.
- Гейт: `npm ci && npm run typecheck && npm test && npm run lint && npm run build && npm run e2e`.
