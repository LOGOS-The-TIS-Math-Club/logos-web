import { getCurrentUser } from "../auth/server.ts";
import { isSignInConfigured } from "../auth/config.ts";
import { clientError } from "../server/errors.ts";
export async function leadershipAccess() {
  if (!isSignInConfigured()) return "unconfigured" as const;
  try {
    return (await getCurrentUser()).admin
      ? ("ready" as const)
      : ("denied" as const);
  } catch (error) {
    return clientError(error).status === 401
      ? ("anonymous" as const)
      : ("unavailable" as const);
  }
}
