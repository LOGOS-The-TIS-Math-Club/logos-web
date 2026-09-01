import { isNeonAuthConfigured } from "@/lib/auth/neon.server";
import { SignInButton } from "../auth-controls";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const configured = isNeonAuthConfigured();
  return (
    <section
      aria-labelledby="sign-in-title"
      className="mx-auto max-w-lg space-y-5"
    >
      <h1 id="sign-in-title" className="text-primary text-2xl font-semibold">
        Sign in to LOGOS
      </h1>
      <p className="text-muted-foreground">
        Use the approved Google account for the non-production environment.
        Signing in does not grant club membership or technical access.
      </p>
      {configured ? (
        <SignInButton />
      ) : (
        <p role="status" className="border-border rounded-component border p-4">
          Non-production sign-in is not configured yet.
        </p>
      )}
    </section>
  );
}
