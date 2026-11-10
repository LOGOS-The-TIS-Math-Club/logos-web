import type { CurrentUser } from "./current-user.ts";
import { clientError } from "../server/errors.ts";
import { privateHeaders } from "../server/http.ts";
import { returnDestination, signInLocation } from "./navigation.ts";

export async function completeSignIn(request: Request, currentUser: () => Promise<CurrentUser>) {
  const intended = new URL(request.url).searchParams.get("returnTo");
  let destination: string;
  try {
    const user = await currentUser();
    destination = returnDestination(intended, user) ?? signInLocation("complete", intended);
  } catch (error) {
    const code = clientError(error).code;
    destination = signInLocation(code === "UNAUTHENTICATED" ? "provider" : "verification", intended);
  }
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: destination } });
}
