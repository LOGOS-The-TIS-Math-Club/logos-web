import { getCurrentUser } from "./server.ts";
import { isSignInConfigured } from "./config.ts";
import { getDatabase } from "../server/database.ts";
import { getOwnApplications } from "../access/operations.ts";
import { resolveAccount } from "./account-state.ts";

export function readAccount() {
  return resolveAccount({
    configured: isSignInConfigured(), currentUser: getCurrentUser,
    applications: id => getOwnApplications(getDatabase(), id),
  });
}
