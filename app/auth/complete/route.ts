import { getCurrentUser } from "../../../src/auth/server.ts";
import { handleErrors, json } from "../../../src/server/http.ts";
export const dynamic = "force-dynamic";
export async function GET() {
  return handleErrors(async () => json(await getCurrentUser()));
}
