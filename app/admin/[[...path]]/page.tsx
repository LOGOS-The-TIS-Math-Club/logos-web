import { isLeadershipPath } from "../../../src/admin/navigation.ts";
import { notFound } from "next/navigation.js";
import { AdminShell } from "../../../components/admin/shell.tsx";
import { leadershipAccess } from "../../../src/admin/server.ts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Leadership controls" };
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  if (!isLeadershipPath("/admin" + (path.length ? "/" + path.join("/") : "")))
    notFound();
  return <AdminShell path={path} access={await leadershipAccess()} />;
}
