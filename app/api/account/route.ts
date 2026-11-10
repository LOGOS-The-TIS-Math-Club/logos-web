import { readAccount } from "../../../src/auth/account.ts";
import { json } from "../../../src/server/http.ts";
export const dynamic = "force-dynamic";
export async function GET() { return json(await readAccount()); }
