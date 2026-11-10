import { Dashboard } from "../../components/dashboard/dashboard.tsx";
import { getDashboardData } from "../../src/dashboard/operations.ts";
import { readProtected } from "../../src/dashboard/server.ts";
import { getDatabase } from "../../src/server/database.ts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Member dashboard" };
export default async function DashboardPage() {
  return (
    <Dashboard
      initial={await readProtected((user) =>
        getDashboardData(getDatabase(), user),
      )}
    />
  );
}
