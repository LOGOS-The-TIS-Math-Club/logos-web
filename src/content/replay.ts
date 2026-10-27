import { createHash } from "node:crypto";
import type postgres from "postgres";
import { BackendError } from "../server/errors.ts";

type Creation =
  | "story"
  | "announcement"
  | "leadership"
  | "resource"
  | "club_info"
  | "image";

// Inputs have already passed the feature schemas. Object order is not meaningful.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => [key, canonical(v)]),
    );
  }
  return value;
}

export function creationHash(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(input)))
    .digest("hex");
}

export async function createContentOnce(
  sql: postgres.Sql,
  actor: string,
  operation: Creation,
  requestId: string,
  input: unknown,
  create: (tx: postgres.TransactionSql) => Promise<postgres.Row>,
): Promise<postgres.Row> {
  const hash = creationHash(input);
  return sql.begin(async (tx) => {
    // Replays are still protected, including after an administrator loses access.
    await tx`select people.require_admin(${actor})`;
    // Transaction-scoped lock serializes the whole save, including image insertion.
    // The composite primary key independently enforces one receipt per scope.
    await tx`select pg_advisory_xact_lock(hashtextextended(${`${actor}/${operation}/${requestId}`},0))`;
    const [receipt] =
      await tx`select input_hash,result from operations.content_creations
      where actor_id=${actor} and operation=${operation} and request_id=${requestId}`;
    if (receipt) {
      if (receipt.input_hash !== hash)
        throw new BackendError(
          "CONFLICT",
          "This requestId was already used with different content. Start a new save with a new requestId.",
          409,
        );
      return receipt.result;
    }
    // Persist the JSON response, not a pointer to mutable content. Later edits must
    // not change what a retry of this creation returns. A failure rolls back both.
    const result = JSON.parse(JSON.stringify(await create(tx)));
    await tx`insert into operations.content_creations(actor_id,operation,request_id,input_hash,result)
      values(${actor},${operation},${requestId},${hash},${tx.json(result)})`;
    return result;
  });
}
