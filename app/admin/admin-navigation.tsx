"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ADMIN_SECTIONS } from "./admin-sections";

type AdminSection = (typeof ADMIN_SECTIONS)[number];

const GROUPS: readonly AdminSection["group"][] = [
  "Club",
  "Content",
  "Operations",
];

export function AdminNavigation({
  sections,
}: {
  sections: readonly AdminSection[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Leadership tools" className="mb-8 space-y-3">
      <Link
        href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
        className={`control min-h-9 px-3 text-[0.625rem] ${pathname === "/admin" ? "control-primary" : ""}`}
      >
        Club tools
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((group) => {
          const groupSections = sections.filter(
            (section) => section.group === group,
          );
          if (groupSections.length === 0) return null;

          const headingId = `admin-nav-${group.toLowerCase()}`;
          return (
            <section
              key={group}
              aria-labelledby={headingId}
              className="border-border bg-surface min-w-0 border p-3"
            >
              <h2
                id={headingId}
                className="text-subtle-foreground mb-2 text-[0.625rem] font-semibold tracking-widest uppercase"
              >
                {group}
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {groupSections.map((section) => {
                  const active =
                    pathname === section.href ||
                    pathname.startsWith(`${section.href}/`);
                  return (
                    <li key={section.href}>
                      <Link
                        href={section.href}
                        aria-current={active ? "page" : undefined}
                        className={`control min-h-9 px-3 text-[0.625rem] ${active ? "control-primary" : ""}`}
                      >
                        {section.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </nav>
  );
}
