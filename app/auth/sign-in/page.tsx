import { isNeonAuthConfigured } from "@/lib/auth/neon.server";
import { AppPage } from "@/components/layout/app-page";

import { SignInButton } from "../auth-controls";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const configured = isNeonAuthConfigured();

  return (
    <AppPage
      width="narrow"
      eyebrow="Account"
      title="Sign in to LOGOS"
      lede="Signing in confirms you are a Tokyo International School student. It does not create a membership or grant any access on its own."
    >
      {configured ? (
        <SignInButton />
      ) : (
        <p role="status" className="panel text-muted-foreground p-5 text-sm">
          Sign-in is not configured for this environment yet.
        </p>
      )}
    </AppPage>
  );
}
