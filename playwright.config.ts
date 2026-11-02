import { defineConfig, devices } from "@playwright/test";

/** prod — `npm start`-подобный запуск (Fastify отдаёт сборку); dev — `npm run dev` с прокси /api. */
const prodPort = 3100;
const devApiPort = 3101;
const devWebPort = 5174;
/** Модели для выбора в e2e; ключа нет — отвечает заглушка с выбранной моделью в meta. */
const llmEnv = {
  LLM_API_KEY: "",
  LLM_MODEL: "claude-sonnet-5-5",
  LLM_MODELS: "claude-sonnet-5-5,claude-opus-5-5,claude-haiku-5-5",
};

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
      env: { ...llmEnv, PORT: String(prodPort) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      url: `http://127.0.0.1:${devWebPort}/api/health`,
      env: { ...llmEnv, PORT: String(devApiPort), WEB_PORT: String(devWebPort) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
