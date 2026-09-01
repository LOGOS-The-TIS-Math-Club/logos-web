import { NextResponse } from "next/server";

import { getNeonAuth } from "@/lib/auth/neon.server";
import { issueSessionCsrfCookie } from "@/lib/auth/session-csrf.server";

export async function GET() {
  try {
    const result = await getNeonAuth().getSession();
    if (result.error || !result.data?.session.id) throw new Error("No session");
    await issueSessionCsrfCookie(result.data.session.id);
    return NextResponse.json(
      { ready: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ code: "SESSION_INVALID" }, { status: 401 });
  }
}
