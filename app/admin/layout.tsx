import type { ReactNode } from "react";

import { hasCapability } from "@/lib/auth/capabilities";
import { resolveCurrentIdentity } from "@/lib/auth/identity-access.server";

import { AdminNavigation } from "./admin-navigation";
import { ADMIN_SECTIONS } from "./admin-sections";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let accessLevel: string | null = null;
  try {
    accessLevel = (await resolveCurrentIdentity()).accessLevel;
  } catch {
    // The landing page and each section render their own signed-out or denied
    // state. Keep this shared navigation absent when identity cannot be read.
  }

  const sections = ADMIN_SECTIONS.filter((section) =>
    hasCapability(accessLevel, section.capability),
  );

  return (
    <>
      {sections.length > 0 ? <AdminNavigation sections={sections} /> : null}
      {children}
    </>
  );
}
