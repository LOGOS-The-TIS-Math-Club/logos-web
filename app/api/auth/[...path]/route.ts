import { getNeonAuth } from "@/lib/auth/neon.server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export function GET(request: Request, context: Context) {
  return getNeonAuth().handler().GET(request, context);
}

export function POST(request: Request, context: Context) {
  return getNeonAuth().handler().POST(request, context);
}
