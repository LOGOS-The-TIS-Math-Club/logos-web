import "server-only";

import type { PgDatabase } from "drizzle-orm/pg-core";
import { z } from "zod";

import {
  completeDurableOperation,
  failDurableOperation,
  type ClaimedDurableOperation,
} from "@/lib/security/durable-operations";
import {
  failureForStatus,
  ProviderFailure,
  readJson,
  type AccessTokenProvider,
} from "@/lib/workspace/provider.server";

export const GMAIL_OPERATION_TYPE = "gmail_transactional_send";
const Message = z.object({
  to: z.string().email().max(320),
  subject: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => !/[\r\n]/.test(value)),
  text: z.string().min(1).max(20_000),
});
export type GmailMessage = z.infer<typeof Message>;
export interface GmailTransport {
  send(
    message: GmailMessage,
    signal: AbortSignal,
  ): Promise<{ readonly id: string }>;
}

function encodeMessage(message: GmailMessage): string {
  const raw = [
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    message.text,
  ].join("\r\n");
  return Buffer.from(raw, "utf8").toString("base64url");
}

export class GoogleGmailTransport implements GmailTransport {
  constructor(
    private readonly tokens: AccessTokenProvider,
    private readonly timeoutMs = 10_000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(
    input: GmailMessage,
    parentSignal: AbortSignal,
  ): Promise<{ readonly id: string }> {
    const message = Message.parse(input);
    const token = await this.tokens.getAccessToken(parentSignal);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = AbortSignal.any([parentSignal, timeout]);
    let response: Response;
    try {
      response = await this.fetcher(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ raw: encodeMessage(message) }),
          signal,
        },
      );
    } catch {
      // Once dispatch starts, a network failure cannot prove non-acceptance.
      throw new ProviderFailure("delivery_unknown", false);
    }
    if (!response.ok) {
      if (response.status >= 500)
        throw new ProviderFailure("delivery_unknown", false);
      throw failureForStatus(response.status);
    }
    const result = z
      .object({ id: z.string().min(1).max(256) })
      .safeParse(await readJson(response));
    if (!result.success) throw new ProviderFailure("delivery_unknown", false);
    return result.data;
  }
}

export async function processGmailOperation(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>;
  operation: ClaimedDurableOperation;
  message: GmailMessage;
  transport: GmailTransport;
  retryDelaySeconds?: number;
  now?: () => number;
}): Promise<"succeeded" | "retry_scheduled" | "failed" | "delivery_unknown"> {
  const { db, operation, transport } = options;
  if (
    operation.type !== GMAIL_OPERATION_TYPE ||
    operation.status !== "processing"
  )
    throw new Error("gmail_operation_invalid");

  const leaseExpiresAt = new Date(operation.leaseExpiresAt).getTime();
  const now = options.now?.() ?? Date.now();
  if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt - now < 15_000) {
    await failDurableOperation({
      db,
      id: operation.id,
      leaseToken: operation.leaseToken,
      failureCode: "LEASE_TOO_SHORT",
      retryDelaySeconds: options.retryDelaySeconds ?? 30,
    });
    return operation.attemptCount >= operation.maxAttempts
      ? "failed"
      : "retry_scheduled";
  }

  let providerId: string;
  try {
    const message = Message.parse(options.message);
    const result = await transport.send(message, AbortSignal.timeout(10_000));
    providerId = z.string().min(1).max(256).parse(result.id);
  } catch (error) {
    if (error instanceof ProviderFailure && error.code === "delivery_unknown") {
      const transitioned = await completeDurableOperation({
        db,
        id: operation.id,
        leaseToken: operation.leaseToken,
        status: "ambiguous",
        failureCode: "DELIVERY_UNKNOWN",
      });
      if (!transitioned) throw new Error("gmail_transition_rejected");
      return "delivery_unknown";
    }
    if (error instanceof ProviderFailure && error.retryable) {
      const transitioned = await failDurableOperation({
        db,
        id: operation.id,
        leaseToken: operation.leaseToken,
        failureCode: error.code.toUpperCase(),
        retryDelaySeconds:
          options.retryDelaySeconds ??
          Math.min(3600, Math.max(1, 2 ** operation.attemptCount)),
      });
      if (!transitioned) throw new Error("gmail_transition_rejected");
      return operation.attemptCount >= operation.maxAttempts
        ? "failed"
        : "retry_scheduled";
    }
    const transitioned = await completeDurableOperation({
      db,
      id: operation.id,
      leaseToken: operation.leaseToken,
      status: "failed",
      failureCode:
        error instanceof ProviderFailure
          ? error.code.toUpperCase()
          : "DELIVERY_INVALID",
    });
    if (!transitioned) throw new Error("gmail_transition_rejected");
    return "failed";
  }

  // A database error after provider acceptance must never be rewritten as a
  // provider failure. The caller must alert and investigate instead of resend.
  const transitioned = await completeDurableOperation({
    db,
    id: operation.id,
    leaseToken: operation.leaseToken,
    status: "succeeded",
    providerReference: providerId,
  });
  if (!transitioned) throw new Error("gmail_post_acceptance_transition_failed");
  return "succeeded";
}
