import { resolveCurrentIdentity } from "@/lib/auth/identity-access.server";
import Link from "next/link";

import { hasCapability } from "@/lib/auth/capabilities";
import { SignOutButton } from "../auth-controls";

export const dynamic = "force-dynamic";

export default async function AuthStatusPage() {
  let identity;
  try {
    identity = await resolveCurrentIdentity();
  } catch {
    identity = null;
  }
  return (
    <section
      aria-labelledby="status-title"
      className="mx-auto max-w-lg space-y-5"
    >
      <h1 id="status-title" className="text-primary text-2xl font-semibold">
        Identity status
      </h1>
      {!identity ? (
        <div
          role="alert"
          className="border-danger rounded-component border p-4"
        >
          <p>Your session or identity could not be verified.</p>
          <a
            className="text-primary mt-3 inline-block underline"
            href="/auth/sign-in"
          >
            Return to sign in
          </a>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground">Signed in as {identity.email}</p>
          <p
            role="status"
            className="border-border rounded-component border p-4"
          >
            {identity.affiliationStatus === "verified"
              ? "School affiliation verified."
              : identity.affiliationStatus === "revoked"
                ? "Access has been revoked."
                : "School affiliation is pending verification."}
          </p>
          <p className="text-muted-foreground text-sm">
            Technical access: {identity.accessLevel ?? "none"}
          </p>
          {/* Leadership tools were previously reachable only by typing the
              URL. The identity is already resolved here, so surfacing the
              entry point costs nothing extra. */}
          {hasCapability(identity.accessLevel, "application:review") ? (
            <Link href="/admin" className="link-underline text-sm font-medium">
              Open leadership tools
            </Link>
          ) : null}
          <SignOutButton />
        </>
      )}
    </section>
  );
}
