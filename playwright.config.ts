import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && tsx src/server/main.ts`,
    url: `http://127.0.0.1:${port}/api/health`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
