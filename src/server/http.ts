import { randomUUID } from "node:crypto";
import { BackendError, clientError } from "./errors.ts";

export const privateHeaders = {
  "Cache-Control": "no-store, private",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export function json(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: privateHeaders });
}
export async function readJson(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new BackendError(
      "INVALID_INPUT",
      "Send an application/json body.",
      415,
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new BackendError("INVALID_INPUT", "A request body is required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BackendError("TOO_LARGE", "The request is too large.", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new BackendError("INVALID_INPUT", "The JSON body is invalid.", 400);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
export function requireSameOrigin(request: Request, appUrl: string) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(appUrl).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new BackendError(
      "FORBIDDEN",
      "Send this request from the club website.",
      403,
    );
}
export async function handleErrors(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    const safe = clientError(error);
    const requestId = randomUUID();
    if (safe.status >= 500) {
      // Never log input, SQL text, credentials, provider tokens or raw error messages.
      console.error(
        JSON.stringify({
          requestId,
          event: "backend.failure",
          type: error instanceof Error ? error.name : "Unknown",
          code: String((error as { code?: string })?.code ?? "unknown").slice(
            0,
            40,
          ),
        }),
      );
    }
    return Response.json(
      {
        error: {
          code: safe.code,
          message: safe.message,
          ...(safe.fields ? { fields: safe.fields } : {}),
          requestId,
        },
      },
      { status: safe.status, headers: privateHeaders },
    );
  }
}
