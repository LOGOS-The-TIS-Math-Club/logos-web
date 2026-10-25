import { getAuth } from "../../../../src/auth/provider.ts";
import {
  handleErrors,
  readJson,
  requireSameOrigin,
} from "../../../../src/server/http.ts";
import { BackendError } from "../../../../src/server/errors.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleErrors(async () => {
    if (request.method !== "GET")
      requireSameOrigin(
        request,
        process.env.APP_URL ?? "http://localhost:3000",
      );
    const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
    // Expose only the Google/session lifecycle needed by LOGOS. Provider email login
    // and account-management methods are not an alternate application sign-in path.
    if (
      !["sign-in/social", "get-session", "sign-out", "link-social"].includes(
        path,
      )
    )
      throw new BackendError(
        "NOT_FOUND",
        "Authentication endpoint not found.",
        404,
      );
    if (path === "sign-in/social" || path === "link-social") {
      const body = await readJson(request.clone(), 8192);
      if (
        !body ||
        typeof body !== "object" ||
        !("provider" in body) ||
        body.provider !== "google"
      )
        throw new BackendError("FORBIDDEN", "Use Google sign-in.", 403);
    }
    const handlers = getAuth().handler();
    const method = request.method as keyof typeof handlers;
    const response = await handlers[method](request, context);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  });
}
export { handler as GET, handler as POST };
