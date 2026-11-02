/**
 * Перевод ошибок ядра в ApiError с HTTP-кодом по смыслу.
 * Ядро (#2) бросает ошибку с полем `code` (строка) и русским `message`;
 * HTTP-код берётся из `statusCode`/`status`, если он задан, иначе — по коду.
 */
import type { ApiError } from "../contract";

const STATUS_BY_CODE: Record<string, number> = {
  invalid_input: 400,
  unsupported: 422,
  unsupported_input: 422,
  input_too_large: 413,
  no_api_key: 503,
  llm_config: 503,
  config: 503,
  llm_unavailable: 502,
  llm_error: 502,
  provider_error: 502,
  rate_limit: 429,
  llm_rate_limit: 429,
  timeout: 504,
  llm_timeout: 504,
  invalid_output: 502,
  llm_invalid_output: 502,
};

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "Некорректные входные данные",
  413: "Входные данные слишком большие",
  422: "Входные данные не поддерживаются",
  429: "Превышен лимит запросов к модели, повторите позже",
  502: "Модель вернула ошибку или некорректный ответ",
  503: "Генерация не настроена: проверьте настройки модели",
  504: "Модель не ответила вовремя",
};

export function apiError(code: string, message: string, details?: unknown): ApiError {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

const hasCyrillic = (s: unknown): s is string => typeof s === "string" && /[а-яё]/i.test(s);

/** Ошибка ядра → [HTTP-код, тело]. Незнакомое — 500 без утечки деталей. */
export function mapCoreError(err: unknown): [number, ApiError] | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { code?: unknown; message?: unknown; statusCode?: unknown; status?: unknown; details?: unknown };
  if (typeof e.code !== "string" || e.code.startsWith("FST_")) return null;
  const explicit = [e.statusCode, e.status].find(
    (s): s is number => typeof s === "number" && s >= 400 && s < 600,
  );
  const status = explicit ?? STATUS_BY_CODE[e.code];
  if (status === undefined) return null;
  const message = hasCyrillic(e.message) ? e.message : (MESSAGE_BY_STATUS[status] ?? "Ошибка генерации");
  return [status, apiError(e.code, message, e.details)];
}
