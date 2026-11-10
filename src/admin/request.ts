export class AdminRequestError extends Error {
  status: number;
  fields?: { field: string; message: string }[];
  constructor(
    status: number,
    message: string,
    fields?: { field: string; message: string }[],
  ) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export async function adminRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new AdminRequestError(
      503,
      "The server response could not be read. Your entries are retained. Check the saved record before retrying.",
    );
  }
  if (!response.ok)
    throw new AdminRequestError(
      response.status,
      response.status === 409
        ? "A newer record or conflicting save was found. Your draft is still here. Check the saved version before trying again."
        : response.status === 403 || response.status === 401
          ? "Your leadership access could not be verified. Return to your account."
          : response.status === 400 || response.status === 422
            ? result.error?.fields
                ?.map(
                  (f: { field: string; message: string }) =>
                    `${f.field}: ${f.message}`,
                )
                .join(". ") ||
              result.error?.message ||
              "Check the entered values."
            : "The request could not be completed. Your entries are retained. Check the current record before retrying.",
      result.error?.fields,
    );
  return result.data as T;
}
