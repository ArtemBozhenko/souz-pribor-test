/** Точка входа сервера: `npm run dev` (API) и `npm start` (API + собранный фронт). */
import "dotenv/config";
import path from "node:path";
import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const webDir = path.resolve(import.meta.dirname, "../../dist/web");

const app = await buildApp({ webDir, logger: true });
await app.listen({ port, host });
