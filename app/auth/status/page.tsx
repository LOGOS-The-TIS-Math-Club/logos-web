import Link from "next/link";

import { AppPage } from "@/components/layout/app-page";
import { hasCapability } from "@/lib/auth/capabilities";
import { resolveCurrentIdentity } from "@/lib/auth/identity-access.server";

import { SignOutButton } from "../auth-controls";

export const dynamic = "force-dynamic";

/** Affiliation state rendered as a labelled status, not just a colour. */
const AFFILIATION_COPY: Record<string, { label: string; detail: string }> = {
  verified: {
    label: "Verified",
    detail: "Your Tokyo International School affiliation is confirmed.",
  },
  revoked: {
    label: "Revoked",
    detail: "Access for this account has been revoked.",
  },
};

const AFFILIATION_PENDING = {
  label: "Pending",
  detail:
    "We could not confirm a tokyois.com account from your sign-in. Try signing in with your school account.",
};

export default async function AuthStatusPage() {
  let identity;
  try {
    identity = await resolveCurrentIdentity();
  } catch {
    identity = null;
  }

  if (!identity) {
    return (
      <AppPage
        width="narrow"
        eyebrow="Account"
        title="Session could not be verified"
        lede="Your sign-in could not be confirmed. This usually means the session expired."
      >
        <div role="alert" className="panel ruled-left space-y-3 border-l-2 p-6">
          <p>
            Your identity could not be verified, so no account details can be
            shown.
          </p>
          <Link href="/auth/sign-in" className="link-underline font-medium">
            Return to sign in
          </Link>
        </div>
      </AppPage>
    );
  }

  const affiliation =
    AFFILIATION_COPY[identity.affiliationStatus] ?? AFFILIATION_PENDING;
  const isLeadership = hasCapability(
    identity.accessLevel,
    "application:review",
  );

  return (
    <AppPage
      width="narrow"
      eyebrow="Account"
      title="Your account"
      lede={`Signed in as ${identity.email}`}
      actions={<SignOutButton />}
    >
      <dl className="border-border divide-border divide-y border-t border-b">
        <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
          <dt className="eyebrow">School affiliation</dt>
          <dd className="text-right">
            <span className="font-medium">{affiliation.label}</span>
            <span className="text-muted-foreground mt-1 block max-w-sm text-sm">
              {affiliation.detail}
            </span>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
          <dt className="eyebrow">Technical access</dt>
          <dd className="datum text-sm">{identity.accessLevel ?? "none"}</dd>
        </div>
      </dl>

      {/*
        Leadership tools were previously reachable only by typing the URL.
        The identity is already resolved here, so surfacing the entry point
        costs no additional query.
      */}
      {isLeadership ? (
        <div className="plated">
          <div className="panel-lifted flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="space-y-1">
              <p className="heading-3">Leadership tools</p>
              <p className="text-muted-foreground text-sm">
                Applications, members, sessions, attendance and announcements.
              </p>
            </div>
            <Link href="/admin" className="action action-primary">
              <span className="action-label">Open</span>
              <span className="action-label-hover" aria-hidden="true">
                Open
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}
