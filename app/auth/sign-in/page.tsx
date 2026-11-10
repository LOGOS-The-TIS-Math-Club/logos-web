import { SignInPanel } from "../../../components/sign-in-panel.tsx";
import { readAccount } from "../../../src/auth/account.ts";
import { internalDestination } from "../../../src/auth/navigation.ts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <SignInPanel initial={await readAccount()}
    intended={internalDestination(params.returnTo)}
    notice={typeof params.notice === "string" ? params.notice : params.error ? "provider" : null} />;
}
