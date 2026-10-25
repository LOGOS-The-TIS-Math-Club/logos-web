import { createApi } from "../../../src/server/api.ts";
import { getDatabase } from "../../../src/server/database.ts";
import { getCurrentUser } from "../../../src/auth/server.ts";
import { handleErrors } from "../../../src/server/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function handler(request: Request) {
  return handleErrors(() =>
    createApi({
      sql: getDatabase(),
      currentUser: getCurrentUser,
      appUrl: process.env.APP_URL ?? "http://localhost:3000",
    })(request),
  );
}
export { handler as GET, handler as POST, handler as PUT };
