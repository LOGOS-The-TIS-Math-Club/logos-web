import { getAuth } from "./src/auth/provider.ts";
// SDK exchanges the OAuth session verifier; authorization still occurs inside every API.
export default function proxy(request: import("next/server.js").NextRequest) {
  return getAuth().middleware({ loginUrl: "/" })(request);
}
export const config = { matcher: ["/auth/complete"] };
