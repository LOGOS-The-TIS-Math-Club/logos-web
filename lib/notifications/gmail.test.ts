import { beforeEach, describe, expect, test, vi } from "vitest";

const durable = vi.hoisted(() => ({
  complete: vi.fn().mockResolvedValue(true),
  fail: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/security/durable-operations", async (loadOriginal) => {
  const original =
    await loadOriginal<typeof import("@/lib/security/durable-operations")>();
  return {
    ...original,
    completeDurableOperation: durable.complete,
    failDurableOperation: durable.fail,
  };
});

import {
  GMAIL_OPERATION_TYPE,
  GoogleGmailTransport,
  processGmailOperation,
  type GmailTransport,
} from "./gmail.server";
import type { ClaimedDurableOperation } from "@/lib/security/durable-operations";
import { ProviderFailure } from "@/lib/workspace/provider.server";

const operation: ClaimedDurableOperation = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  correlationId: "550e8400-e29b-41d4-a716-446655440002",
  auditEventId: "550e8400-e29b-41d4-a716-446655440003",
  type: GMAIL_OPERATION_TYPE,
  idempotencyKey: "synthetic-email-1",
  status: "processing",
  payload: { targetId: "synthetic-record-1", schemaVersion: 1 },
  attemptCount: 1,
  maxAttempts: 3,
  leaseToken: "controlled-lease",
  leaseExpiresAt: "2099-09-01T01:00:00Z",
  createdAt: "2026-09-01T00:00:00Z",
};
const message = {
  to: "synthetic-recipient@example.test",
  subject: "Synthetic notice",
  text: "Synthetic content",
};
const db = {} as never;

describe("durable Gmail delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  test("records success with a bounded provider reference", async () => {
    const transport: GmailTransport = {
      send: vi.fn().mockResolvedValue({ id: "provider-id" }),
    };
    await expect(
      processGmailOperation({ db, operation, message, transport }),
    ).resolves.toBe("succeeded");
    expect(durable.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        providerReference: "provider-id",
      }),
    );
  });

  test("schedules a bounded retry only for a known retryable failure", async () => {
    const transport: GmailTransport = {
      send: vi
        .fn()
        .mockRejectedValue(new ProviderFailure("provider_transient", true)),
    };
    await expect(
      processGmailOperation({ db, operation, message, transport }),
    ).resolves.toBe("retry_scheduled");
    expect(durable.fail).toHaveBeenCalledWith(
      expect.objectContaining({ retryDelaySeconds: 2 }),
    );
    expect(durable.complete).not.toHaveBeenCalled();
  });

  test("marks permanent failure without retry", async () => {
    const transport: GmailTransport = {
      send: vi
        .fn()
        .mockRejectedValue(new ProviderFailure("permission_denied", false)),
    };
    await expect(
      processGmailOperation({ db, operation, message, transport }),
    ).resolves.toBe("failed");
    expect(durable.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureCode: "PERMISSION_DENIED",
      }),
    );
    expect(durable.fail).not.toHaveBeenCalled();
  });

  test("records ambiguous delivery and never schedules a resend", async () => {
    const transport: GmailTransport = {
      send: vi
        .fn()
        .mockRejectedValue(new ProviderFailure("delivery_unknown", false)),
    };
    await expect(
      processGmailOperation({ db, operation, message, transport }),
    ).resolves.toBe("delivery_unknown");
    expect(durable.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ambiguous",
        failureCode: "DELIVERY_UNKNOWN",
      }),
    );
    expect(durable.fail).not.toHaveBeenCalled();
  });

  test("treats transport loss after dispatch as delivery unknown", async () => {
    const transport = new GoogleGmailTransport(
      { getAccessToken: vi.fn().mockResolvedValue("controlled") },
      1000,
      vi.fn().mockRejectedValue(new Error("socket closed")),
    );
    await expect(
      transport.send(message, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ code: "delivery_unknown", retryable: false });
  });

  test("classifies an explicit pre-acceptance rate limit as retryable", async () => {
    const transport = new GoogleGmailTransport(
      { getAccessToken: vi.fn().mockResolvedValue("controlled") },
      1000,
      vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
    );
    await expect(
      transport.send(message, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ code: "provider_transient", retryable: true });
  });

  test("rejects uncommitted or unrelated operations before sending", async () => {
    const transport: GmailTransport = { send: vi.fn() };
    await expect(
      processGmailOperation({
        db,
        operation: { ...operation, status: "pending" },
        message,
        transport,
      }),
    ).rejects.toThrow("gmail_operation_invalid");
    expect(transport.send).not.toHaveBeenCalled();
  });

  test("rejects header injection as a terminal validation failure", async () => {
    const transport: GmailTransport = { send: vi.fn() };
    await expect(
      processGmailOperation({
        db,
        operation,
        message: {
          ...message,
          subject: "Notice\r\nBcc: attacker@example.test",
        },
        transport,
      }),
    ).resolves.toBe("failed");
    expect(transport.send).not.toHaveBeenCalled();
    expect(durable.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureCode: "DELIVERY_INVALID",
      }),
    );
  });

  test("does not dispatch when the remaining lease cannot cover the request", async () => {
    const transport: GmailTransport = { send: vi.fn() };
    await expect(
      processGmailOperation({
        db,
        operation: { ...operation, leaseExpiresAt: "2026-09-01T00:00:10Z" },
        message,
        transport,
        now: () => new Date("2026-09-01T00:00:00Z").getTime(),
      }),
    ).resolves.toBe("retry_scheduled");
    expect(transport.send).not.toHaveBeenCalled();
    expect(durable.fail).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "LEASE_TOO_SHORT" }),
    );
  });

  test("does not rewrite a post-acceptance database failure as provider failure", async () => {
    durable.complete.mockResolvedValueOnce(false);
    const transport: GmailTransport = {
      send: vi.fn().mockResolvedValue({ id: "accepted-provider-id" }),
    };
    await expect(
      processGmailOperation({ db, operation, message, transport }),
    ).rejects.toThrow("gmail_post_acceptance_transition_failed");
    expect(durable.fail).not.toHaveBeenCalled();
    expect(durable.complete).toHaveBeenCalledTimes(1);
  });
});
