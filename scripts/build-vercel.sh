#!/bin/sh
# Сборка для Vercel: фронт (Vite) + сервер одним ESM-бандлом со всеми зависимостями.
# Бандл нужен потому, что рантайм Vercel не поддерживает ни ESM-импорты без расширений (src),
# ни require() ESM-модулей внутри зависимостей (@fastify/static → content-disposition).
set -e
npm run build
npx esbuild src/server/vercel.ts --bundle --platform=node --target=node22 --format=esm \
  --outfile=dist/server/vercel.js \
  --banner:js="import{createRequire as __cr}from'node:module';import{fileURLToPath as __fu}from'node:url';import{dirname as __dn}from'node:path';const require=__cr(import.meta.url);const __filename=__fu(import.meta.url);const __dirname=__dn(__filename);"
# Swagger UI берёт файлы из ../static (раздача) и ./static (логотип) относительно модуля —
# после бандла это dist/static и dist/server/static.
for d in dist/static dist/server/static; do
  rm -rf "$d"
  cp -R node_modules/@fastify/swagger-ui/static "$d"
done
