import { getCurrentUser } from "../auth/server.ts";
import type { CurrentUser } from "../auth/current-user.ts";
import { isSignInConfigured } from "../auth/config.ts";
import { clientError } from "../server/errors.ts";
import { requireDashboardUser } from "./operations.ts";
import type { ProtectedState } from "./types.ts";
export async function readProtected<T>(
  load: (user: CurrentUser) => Promise<T>,
): Promise<ProtectedState<T>> {
  if (!isSignInConfigured()) return { status: "unconfigured" };
  try {
    const user = await getCurrentUser();
    requireDashboardUser(user);
    return { status: "ready", data: await load(user) };
  } catch (error) {
    const safe = clientError(error);
    return {
      status:
        safe.status === 401
          ? "anonymous"
          : safe.status === 403 || safe.status === 409
            ? "denied"
            : safe.status === 404
              ? "missing"
              : "unavailable",
    };
  }
}
