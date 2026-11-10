export class ApplicationRequestError extends Error {
  status: number;
  fields: { field: string; message: string }[];
  constructor(
    status: number,
    fields: { field: string; message: string }[] = [],
  ) {
    super("Application request failed");
    this.status = status;
    this.fields = fields;
  }
}
export async function applicationRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApplicationRequestError(response.status, result.error?.fields);
  return result.data as T;
}
