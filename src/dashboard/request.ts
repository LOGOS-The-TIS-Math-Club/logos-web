export class DashboardRequestError extends Error {
  status: number;
  constructor(status: number) {
    super("The dashboard request failed.");
    this.status = status;
  }
}
export async function dashboardRequest<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) throw new DashboardRequestError(response.status);
  return result.data as T;
}
