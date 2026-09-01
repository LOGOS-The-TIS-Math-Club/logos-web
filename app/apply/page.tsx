import Link from "next/link";

import { getMySubmittedApplication } from "@/lib/applications/service.server";
import { resolveCurrentIdentity } from "@/lib/auth/identity-access.server";
import { SignInButton, SignOutButton } from "@/app/auth/auth-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApplicationForm } from "./application-form";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  let identity = null;
  let accessError = null;

  try {
    identity = await resolveCurrentIdentity();
  } catch (err) {
    accessError = err;
  }

  // State 1: Not Authenticated / Session Missing
  if (!identity || accessError) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Apply to LOGOS
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The Tokyo International School Math Club welcomes students in Grades
            9–12. Prior competition experience is not required.
          </p>
        </header>

        <div className="border-border bg-surface rounded-component space-y-6 border p-6 sm:p-8">
          <div className="space-y-2">
            <h2 className="text-foreground text-base font-semibold">
              Step 1: Identify with your School Account
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              LOGOS uses your Tokyo International School Google account (
              <code>@tokyois.com</code>) to verify student identity and prevent
              duplicate submissions.
            </p>
          </div>

          <div className="border-border bg-surface-raised rounded-component text-muted-foreground border p-4 text-xs leading-relaxed">
            <p>
              <strong>Privacy note:</strong> Google sign-in is used solely for
              identification. It does not create public profiles, grant
              unauthorized access, or store your password.
            </p>
          </div>

          <div className="pt-2">
            <SignInButton />
          </div>
        </div>
      </div>
    );
  }

  // State 2: Authenticated but Affiliation Not Verified
  if (!identity.active || identity.affiliationStatus !== "verified") {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Account Verification Required
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            LOGOS applications are open exclusively to verified Tokyo
            International School students.
          </p>
        </header>

        <div className="border-warning bg-warning-surface rounded-component space-y-4 border p-6">
          <div className="space-y-1">
            <h2 className="text-warning text-base font-semibold">
              Unsupported Account: {identity.email}
            </h2>
            <p className="text-foreground text-sm leading-relaxed">
              Your current account is not verified under the{" "}
              <code>@tokyois.com</code> hosted domain. Please sign in using your
              official school email account.
            </p>
          </div>

          <div className="pt-2">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  // State 3: Check for Existing Application
  const existingApp = await getMySubmittedApplication();

  if (existingApp) {
    const statusVariants: Record<
      string,
      "neutral" | "success" | "warning" | "danger" | "info"
    > = {
      submitted: "info",
      reviewing: "warning",
      accepted: "success",
      declined: "neutral",
    };

    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              Application On File
            </h1>
            <StatusBadge
              variant={statusVariants[existingApp.status] ?? "neutral"}
            >
              {existingApp.status.toUpperCase()}
            </StatusBadge>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We have received your application for the 2026–2027 academic year.
          </p>
        </header>

        <div className="border-border bg-surface rounded-component space-y-6 border p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Preferred Name</p>
              <p className="text-foreground text-sm font-medium">
                {existingApp.preferredName}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Grade Level</p>
              <p className="text-foreground text-sm font-medium">
                {existingApp.grade}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Verified Email</p>
              <p className="text-foreground text-sm font-medium">
                {identity.email}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Submission Date</p>
              <p className="text-foreground text-sm font-medium">
                {new Date(existingApp.submittedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="border-border bg-surface-raised rounded-component text-muted-foreground space-y-1 border p-4 text-xs leading-relaxed">
            <p className="text-foreground font-medium">What to expect next:</p>
            <p>
              Club leadership reviews applications continuously. Communications
              and meeting details will be sent to your verified school email
              before regular Friday sessions.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/"
              className="text-primary hover:text-primary-hover text-sm font-semibold"
            >
              ← Back to Home
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  // State 4: Ready to Apply
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          LOGOS Student Application
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The Tokyo International School Math Club • 2026–2027 Academic Year
        </p>
      </header>

      <ApplicationForm verifiedEmail={identity.email} />
    </div>
  );
}
