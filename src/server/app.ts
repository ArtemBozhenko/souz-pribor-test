/** Сервер (#4): Fastify-приложение. Контракт — zod-схемы из src/contract. */
import { existsSync } from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import {
  ApiErrorSchema,
  HealthSchema,
  ProductCardSchema,
  ProductInputSchema,
} from "../contract";
import { generateCard, type GenerateCard } from "../core";
import { apiError, mapCoreError } from "./errors";

export interface AppOptions {
  generate?: GenerateCard;
  /** Каталог собранного фронта; если есть — отдаётся статикой. */
  webDir?: string;
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const generate = options.generate ?? generateCard;
  const app = Fastify({ logger: options.logger ?? false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply
        .code(400)
        .send(apiError("invalid_input", "Некорректные входные данные", err.validation));
    }
    if (isResponseSerializationError(err)) {
      req.log.error(err);
      return reply.code(500).send(apiError("invalid_output", "Ответ не прошёл проверку схемы"));
    }
    const mapped = mapCoreError(err);
    if (mapped) {
      req.log.warn({ code: mapped[1].error.code }, "ошибка ядра");
      return reply.code(mapped[0]).send(mapped[1]);
    }
    if ((err as { statusCode?: number }).statusCode === 400) {
      return reply.code(400).send(apiError("bad_request", "Некорректный запрос"));
    }
    req.log.error(err);
    return reply.code(500).send(apiError("internal", "Внутренняя ошибка сервера"));
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "Союз-Прибор: генератор карточек", version: "0.1.0" },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/api/docs" });

  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/api/health", { schema: { response: { 200: HealthSchema } } }, async () => ({
    ok: true as const,
  }));

  api.post(
    "/api/generate",
    {
      schema: {
        body: ProductInputSchema,
        response: {
          200: ProductCardSchema,
          "4xx": ApiErrorSchema,
          "5xx": ApiErrorSchema,
        },
      },
    },
    async (req) => generate(req.body),
  );

  const webDir = options.webDir;
  if (webDir && existsSync(path.join(webDir, "index.html"))) {
    await app.register(fastifyStatic, { root: webDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) {
        return reply.code(404).send(apiError("not_found", "Маршрут не найден"));
      }
      return reply.sendFile("index.html");
    });
  } else {
    app.setNotFoundHandler((_req, reply) =>
      reply.code(404).send(apiError("not_found", "Маршрут не найден")),
    );
  }

  return app;
}
