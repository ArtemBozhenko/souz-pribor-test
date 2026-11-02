/** Типизированные ошибки ядра. Каждая несёт код и русское сообщение и переводится в ApiError. */
import type { ApiError } from "../../contract";

export type CoreErrorCode =
  | "invalid_json"
  | "invalid_input"
  | "unsupported_model"
  | "llm_not_configured"
  | "llm_auth"
  | "llm_rate_limit"
  | "llm_unavailable"
  | "llm_overloaded"
  | "llm_timeout"
  | "llm_refusal"
  | "llm_truncated"
  | "llm_bad_request"
  | "llm_error"
  | "invalid_output";

/** HTTP-статус, которым сервер отвечает на ошибку ядра. */
export const HTTP_STATUS: Record<CoreErrorCode, number> = {
  invalid_json: 400,
  invalid_input: 400,
  unsupported_model: 400,
  llm_not_configured: 500,
  llm_auth: 502,
  llm_rate_limit: 503,
  llm_unavailable: 502,
  llm_overloaded: 503,
  llm_timeout: 504,
  llm_refusal: 502,
  llm_truncated: 502,
  llm_bad_request: 502,
  llm_error: 502,
  invalid_output: 502,
};

export class CoreError extends Error {
  readonly code: CoreErrorCode;
  readonly details?: unknown;
  /** Идентификатор запроса у провайдера — только для лога. */
  readonly requestId?: string;

  constructor(code: CoreErrorCode, message: string, opts: { details?: unknown; requestId?: string; cause?: unknown } = {}) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "CoreError";
    this.code = code;
    this.details = opts.details;
    this.requestId = opts.requestId;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }

  /** То же, что httpStatus: сервер (src/server/errors.ts) читает statusCode. */
  get statusCode(): number {
    return HTTP_STATUS[this.code];
  }

  toApiError(): ApiError {
    return {
      error: { code: this.code, message: this.message, ...(this.details === undefined ? {} : { details: this.details }) },
    };
  }
}

export function isCoreError(err: unknown): err is CoreError {
  return err instanceof CoreError;
}

interface SdkLikeError {
  status?: number;
  name?: string;
  message?: string;
  requestID?: string | null;
  request_id?: string | null;
  headers?: Headers | Record<string, string> | null;
}

function readRequestId(e: SdkLikeError): string | undefined {
  if (e.requestID) return e.requestID;
  if (e.request_id) return e.request_id;
  const h = e.headers;
  if (!h) return undefined;
  if (typeof (h as Headers).get === "function") {
    return (h as Headers).get("request-id") ?? (h as Headers).get("x-request-id") ?? undefined;
  }
  const rec = h as Record<string, string>;
  return rec["request-id"] ?? rec["x-request-id"];
}

/**
 * Переводит исключение SDK (Anthropic или OpenAI — у обоих `status` и классы *TimeoutError)
 * в CoreError с русским сообщением. Сообщение провайдера в текст не попадает.
 */
export function mapProviderError(err: unknown): CoreError {
  if (isCoreError(err)) return err;
  const e = (err ?? {}) as SdkLikeError;
  const requestId = readRequestId(e);
  const name = e.name ?? "";
  const opts = { requestId, cause: err };

  if (/Timeout/i.test(name) || (err instanceof Error && /timed? ?out/i.test(err.message))) {
    return new CoreError("llm_timeout", "Модель не ответила за отведённое время. Повторите запрос позже.", opts);
  }
  switch (e.status) {
    case 401:
    case 403:
      return new CoreError("llm_auth", "Ключ API не принят провайдером. Проверьте LLM_API_KEY и доступ к модели.", opts);
    case 429:
      return new CoreError("llm_rate_limit", "Превышен лимит запросов к модели. Повторите через минуту.", opts);
    case 529:
      return new CoreError("llm_overloaded", "Сервис модели перегружен. Повторите запрос позже.", opts);
    case 400:
    case 404:
    case 422:
      return new CoreError("llm_bad_request", "Провайдер отклонил запрос. Проверьте модель и параметры в настройках.", opts);
  }
  if (typeof e.status === "number" && e.status >= 500) {
    return new CoreError("llm_unavailable", "Сервис модели временно недоступен. Повторите запрос позже.", opts);
  }
  if (/Connection/i.test(name)) {
    return new CoreError("llm_unavailable", "Не удалось связаться с сервисом модели. Проверьте сеть и LLM_BASE_URL.", opts);
  }
  return new CoreError("llm_error", "Ошибка при обращении к модели.", opts);
}
