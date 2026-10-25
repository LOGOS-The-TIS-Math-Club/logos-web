import { getAuth } from "./provider.ts";
import { createCurrentUser } from "./current-user.ts";
import { getDatabase } from "../server/database.ts";
import { BackendError } from "../server/errors.ts";
export async function getCurrentUser() {
  return createCurrentUser(getDatabase(), async () => {
    const { data, error } = await getAuth().getSession({
      query: { disableCookieCache: "true" },
    });
    if (error)
      throw new BackendError(
        "UNAVAILABLE",
        "Authentication is temporarily unavailable.",
        503,
      );
    if (!data?.user) return null;
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: data.user.emailVerified,
      },
    };
  })();
}
