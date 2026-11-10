import { clientError } from "../server/errors.ts";
import type { CurrentUser } from "./current-user.ts";

export type AccountState =
  | { status: "unconfigured" | "anonymous" | "unavailable" }
  | { status: "denied"; code: string }
  | { status: "signed-in"; user: CurrentUser; hasApplication: boolean | null };

export async function resolveAccount(deps: {
  configured: boolean;
  currentUser: () => Promise<CurrentUser>;
  applications: (id: string) => PromiseLike<readonly unknown[]>;
}): Promise<AccountState> {
  if (!deps.configured) return { status: "unconfigured" };
  let user: CurrentUser;
  try { user = await deps.currentUser(); }
  catch (error) {
    const safe = clientError(error);
    if (safe.code === "UNAUTHENTICATED") return { status: "anonymous" };
    if (safe.status === 403 || safe.status === 409) return { status: "denied", code: safe.code };
    return { status: "unavailable" };
  }
  if (user.admin || user.member) return { status: "signed-in", user, hasApplication: false };
  try {
    const applications = await deps.applications(user.id);
    return { status: "signed-in", user, hasApplication: applications.length > 0 };
  } catch { return { status: "signed-in", user, hasApplication: null }; }
}
