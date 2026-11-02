import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPort = Number(process.env.PORT ?? 3000);

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src/web") } },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    host: "127.0.0.1",
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
  build: { outDir: path.resolve(import.meta.dirname, "dist/web"), emptyOutDir: true },
});
