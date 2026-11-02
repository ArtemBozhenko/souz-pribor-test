import { defineConfig, devices } from "@playwright/test";

/** prod — `npm start`-подобный запуск (Fastify отдаёт сборку); dev — `npm run dev` с прокси /api. */
const prodPort = 3100;
const devApiPort = 3101;
const devWebPort = 5174;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  projects: [
    { name: "prod", use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${prodPort}` } },
    { name: "dev", use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${devWebPort}` } },
  ],
  webServer: [
    {
      command: "npm run build && tsx src/server/main.ts",
      url: `http://127.0.0.1:${prodPort}/api/health`,
      env: { PORT: String(prodPort) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      url: `http://127.0.0.1:${devWebPort}/api/health`,
      env: { PORT: String(devApiPort), WEB_PORT: String(devWebPort) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
