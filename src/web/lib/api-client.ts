/** Единственный модуль вызова API. Типы — из общего контракта. Не класть под src/web/api/: в dev этот путь проксируется на сервер. */
import { ApiErrorSchema, ProductCardSchema, type ProductCard, type ProductInput } from "../../contract";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function generateCard(input: ProductInput, signal?: AbortSignal): Promise<ProductCard> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError("Сервер недоступен. Проверьте подключение и повторите.", "network");
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError(`Сервер вернул некорректный ответ (HTTP ${res.status})`, "bad_response", res.status);
  }

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiClientError(parsed.data.error.message, parsed.data.error.code, res.status);
    }
    throw new ApiClientError(`Ошибка сервера (HTTP ${res.status})`, "http_error", res.status);
  }

  const card = ProductCardSchema.safeParse(body);
  if (!card.success) {
    throw new ApiClientError("Ответ сервера не соответствует формату карточки", "bad_response", res.status);
  }
  return card.data;
}
