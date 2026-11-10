import { isSignInConfigured } from "../auth/config.ts";
import { getCurrentUser } from "../auth/server.ts";
import { getDatabase } from "../server/database.ts";
import { clientError } from "../server/errors.ts";
import { getOwnApplicationEntry } from "./entry.ts";
import type { ApplyState } from "./presentation.ts";

export async function readApplyState(): Promise<ApplyState> {
  if (!isSignInConfigured()) return { status: "unconfigured" };
  try {
    const actor = await getCurrentUser();
    return {
      status: "ready",
      entry: await getOwnApplicationEntry(getDatabase(), actor.id),
    };
  } catch (error) {
    const safe = clientError(error);
    return {
      status:
        safe.status === 401
          ? "anonymous"
          : safe.status === 403 || safe.status === 409
            ? "denied"
            : "unavailable",
    };
  }
}
