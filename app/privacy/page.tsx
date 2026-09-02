import type { Metadata } from "next";

import { ActionLink } from "@/components/ui/action";

export const metadata: Metadata = {
  title: "Application data and privacy",
  description:
    "What LOGOS collects when you apply, why Google sign-in is used, and how to correct or withdraw your application.",
};

/*
 * Moved out of the landing page so the recruitment journey stays short, and so
 * this can be linked directly from the application form.
 *
 * Every statement here describes behaviour that is actually implemented:
 * the collected fields match lib/applications/schema.ts, and the identification
 * model matches the Phase 04 and Phase 06 invariants.
 */

const COLLECTED = [
  "Your preferred name",
  "Your grade level",
  "The mathematical interests you select",
  "Your reason for joining and your learning or contribution goal",
  "Any optional background you choose to share",
  "Whether you can attend the regular meeting time",
] as const;

const NOT_COLLECTED = [
  "Home address",
  "Phone number",
  "Medical or health information",
  "Guardian details",
  "Anything about your academic record",
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-14 py-4">
      <header className="space-y-4">
        <p className="eyebrow">Application data</p>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
          What we collect, and what we do not.
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          LOGOS asks for the least it can while still being able to review your
          application fairly.
        </p>
      </header>

      <section aria-labelledby="collected-heading" className="space-y-6">
        <h2 id="collected-heading" className="text-2xl font-bold">
          What the application collects
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel space-y-4 p-6">
            <h3 className="text-success text-sm font-semibold">We collect</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              {COLLECTED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="panel space-y-4 p-6">
            <h3 className="text-subtle-foreground text-sm font-semibold">
              We never ask for
            </h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              {NOT_COLLECTED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="identity-heading" className="space-y-4">
        <h2 id="identity-heading" className="text-2xl font-bold">
          Why you sign in with Google
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Signing in with your Tokyo International School Google account proves
          that you control that account. It lets us confirm you are a TIS
          student and stops one person submitting applications as someone else,
          or submitting several times.
        </p>
        <div className="panel-lifted space-y-3 p-6">
          <p className="font-semibold">
            Signing in does not make you a member.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            It does not create a member account, grant access to anything, or
            put your name on any list. Membership is a separate decision that
            club leadership makes after reading your application. We never see
            or store your Google password.
          </p>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your school email address and a stable Google account identifier are
          taken from the verified session — you never type them into the form.
        </p>
      </section>

      <section aria-labelledby="access-heading" className="space-y-4">
        <h2 id="access-heading" className="text-2xl font-bold">
          Who can see your application
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Only club leadership members who have been explicitly granted review
          access. Access is denied by default, every review action is recorded
          in an append-only log, and applications are never published or shared
          outside the club.
        </p>
      </section>

      <section aria-labelledby="rights-heading" className="space-y-4">
        <h2 id="rights-heading" className="text-2xl font-bold">
          Correcting or withdrawing your application
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          If you want to change what you submitted, withdraw your application,
          or have your record deleted, speak to club leadership in Room 101 at a
          Friday meeting, or contact the club supervisor through the school.
        </p>
      </section>

      <div className="border-border flex flex-wrap items-center gap-4 border-t pt-8">
        <ActionLink href="/apply" variant="primary">
          Apply to LOGOS
        </ActionLink>
        <ActionLink href="/" variant="quiet">
          Back to home
        </ActionLink>
      </div>
    </div>
  );
}
