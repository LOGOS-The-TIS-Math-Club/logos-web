import { SessionPage } from "../../../../components/dashboard/session-page.tsx";
import { getSessionPageData } from "../../../../src/dashboard/operations.ts";
import { readProtected } from "../../../../src/dashboard/server.ts";
import { getDatabase } from "../../../../src/server/database.ts";
import { z } from "zod";
import { BackendError } from "../../../../src/server/errors.ts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Session details" };
export default async function MemberSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const state = await readProtected((user) => {
    if (!z.uuid().safeParse(id).success)
      throw new BackendError("NOT_FOUND", "Session not found.", 404);
    return getSessionPageData(getDatabase(), user, id);
  });
  return <SessionPage key={id} initial={state} sessionId={id} />;
}
