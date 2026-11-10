import { AttendancePage } from "../../../components/dashboard/attendance-page.tsx";
import { getPersonalData } from "../../../src/dashboard/operations.ts";
import { readProtected } from "../../../src/dashboard/server.ts";
import { getDatabase } from "../../../src/server/database.ts";
export const dynamic = "force-dynamic";
export const metadata = { title: "My attendance" };
export default async function MyAttendancePage() {
  return (
    <AttendancePage
      initial={await readProtected((user) =>
        getPersonalData(getDatabase(), user),
      )}
    />
  );
}
