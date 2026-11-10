import { getAuth } from "./src/auth/provider.ts";
import { NextResponse } from "next/server.js";
import { signInLocation } from "./src/auth/navigation.ts";
// SDK exchanges the OAuth session verifier; authorization still occurs inside every API.
export default async function proxy(request: import("next/server.js").NextRequest) {
  const loginUrl = signInLocation("provider", request.nextUrl.searchParams.get("returnTo"));
  try {
    const response = await getAuth().middleware({ loginUrl })(request);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch {
    return NextResponse.redirect(new URL(loginUrl, request.url), { headers: { "Cache-Control": "no-store, private" } });
  }
}
export const config = { matcher: ["/auth/complete"] };
