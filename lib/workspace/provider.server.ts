import "server-only";

import { z } from "zod";

export const ProviderFailureCodeSchema = z.enum([
  "configuration_invalid",
  "authentication_failed",
  "permission_denied",
  "provider_invalid_response",
  "provider_timeout",
  "provider_transient",
  "provider_permanent",
  "delivery_unknown",
]);
export type ProviderFailureCode = z.infer<typeof ProviderFailureCodeSchema>;

export class ProviderFailure extends Error {
  constructor(
    readonly code: ProviderFailureCode,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ProviderFailure";
  }
}

export interface AccessTokenProvider {
  getAccessToken(signal: AbortSignal): Promise<string>;
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const timeout = AbortSignal.timeout(
    z.number().int().min(100).max(30_000).parse(timeoutMs),
  );
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  try {
    return await fetcher(input, { ...init, signal });
  } catch {
    if (signal.aborted) throw new ProviderFailure("provider_timeout", true);
    throw new ProviderFailure("provider_transient", true);
  }
}

export function failureForStatus(status: number): ProviderFailure {
  if (status === 401)
    return new ProviderFailure("authentication_failed", false);
  if (status === 403 || status === 404)
    return new ProviderFailure("permission_denied", false);
  if (status === 408 || status === 429 || status >= 500)
    return new ProviderFailure("provider_transient", true);
  return new ProviderFailure("provider_permanent", false);
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProviderFailure("provider_invalid_response", false);
  }
}
