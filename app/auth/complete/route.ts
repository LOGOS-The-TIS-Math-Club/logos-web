import { getCurrentUser } from "../../../src/auth/server.ts";
import { completeSignIn } from "../../../src/auth/complete.ts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return completeSignIn(request, getCurrentUser);
}
