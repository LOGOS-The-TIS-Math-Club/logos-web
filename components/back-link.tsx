import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardIcon } from "./dashboard/icon.tsx";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="back-link">
      <DashboardIcon name="left" />
      <span>{children}</span>
    </Link>
  );
}
