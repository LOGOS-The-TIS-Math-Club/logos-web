import { ApplyPanel } from "../../components/apply-panel.tsx";
import { readApplyState } from "../../src/applications/server.ts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Apply" };
export default async function ApplyPage() {
  return <ApplyPanel initial={await readApplyState()} />;
}
