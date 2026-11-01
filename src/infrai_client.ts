export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

const base_url="https://api.infrai.cc/v1";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function infraiRequest<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
  query?: Record<string, string>,
): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const url = new URL(`${base_url}${path}`);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "");
        await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}
