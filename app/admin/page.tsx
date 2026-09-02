import type { Metadata } from "next";
import Link from "next/link";

import { hasCapability, type Capability } from "@/lib/auth/capabilities";
import { resolveCurrentIdentity } from "@/lib/auth/identity-access.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leadership",
  description: "Club leadership tools.",
};

/*
 * Leadership landing page.
 *
 * The admin sections already existed but nothing linked to them, so the only
 * way in was to know and type the URL. This is that missing entry point.
 *
 * Authorization is unchanged: each section still enforces its own capability
 * server-side on entry. This page only decides what to *show*, so a member who
 * reaches it sees an honest explanation rather than a list of dead ends.
 */

const SECTIONS: readonly {
  href: string;
  label: string;
  capability: Capability;
  description: string;
}[] = [
  {
    href: "/admin/applications",
    label: "Applications",
    capability: "application:review",
    description:
      "Read every submitted application, set its review status, and export the full list as CSV.",
  },
  {
    href: "/admin/members",
    label: "Members",
    capability: "membership:read",
    description:
      "The active roster. Activate an accepted applicant into a member, or change a member's status.",
  },
  {
    href: "/admin/sessions",
    label: "Sessions",
    capability: "session:manage",
    description: "Create and edit the Friday meeting sessions.",
  },
  {
    href: "/admin/attendance",
    label: "Attendance",
    capability: "attendance:record",
    description:
      "Record who attended each session, and review expected-absence notices members submitted.",
  },
  {
    href: "/admin/warnings",
    label: "Warnings",
    capability: "warning:manage",
    description: "Manual warning records. Nothing here is automatic.",
  },
];

export default async function AdminIndexPage() {
  let accessLevel: string | null = null;
  let signedIn = false;

  try {
    const identity = await resolveCurrentIdentity();
    signedIn = true;
    accessLevel = identity.accessLevel;
  } catch {
    // Not signed in, or the session could not be resolved. Fall through to the
    // signed-out explanation rather than surfacing provider detail.
  }

  const available = SECTIONS.filter((section) =>
    hasCapability(accessLevel, section.capability),
  );

  if (available.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-5 py-16">
        <p className="eyebrow">Leadership</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-balance">
          You don&rsquo;t have leadership access.
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {signedIn
            ? "Your account is signed in but has not been granted a leadership role. An access administrator has to grant it before these tools appear."
            : "Sign in with the Tokyo International School account that holds your leadership role."}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {!signedIn ? (
            <Link href="/auth/sign-in" className="action action-primary">
              <span className="action-label">Sign in</span>
              <span className="action-label-hover" aria-hidden="true">
                Sign in
              </span>
            </Link>
          ) : null}
          <Link href="/" className="action">
            <span className="action-label">Back to site</span>
            <span className="action-label-hover" aria-hidden="true">
              Back to site
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-4">
      <header className="max-w-2xl space-y-3">
        <p className="eyebrow">Leadership</p>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-balance">
          Club tools.
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Everything here is restricted to leadership accounts and every change
          is recorded in the audit log.
        </p>
      </header>

      <ul className="border-border grid gap-px border sm:grid-cols-2">
        {available.map((section) => (
          <li key={section.href} className="bg-surface">
            <Link
              href={section.href}
              className="hover:bg-surface-raised focus-visible:outline-focus group block h-full p-7 transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 motion-reduce:transition-none"
            >
              <span className="group-hover:text-primary flex items-center gap-2 text-lg font-bold tracking-[-0.015em] transition-colors duration-200 motion-reduce:transition-none">
                {section.label}
                <span
                  aria-hidden="true"
                  className="text-subtle-foreground transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </span>
              <span className="text-muted-foreground mt-2 block text-sm leading-relaxed">
                {section.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
