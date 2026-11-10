"use client";

import { useEffect, useRef, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import type { AccountState } from "../src/auth/account-state.ts";
import { accountDestinations, signInLocation } from "../src/auth/navigation.ts";
import { ActionLink } from "./action.tsx";

const auth = createAuthClient();

export function SignInPanel({ initial, intended, notice }: {
  initial: AccountState; intended: string | null; notice: string | null;
}) {
  const [account, setAccount] = useState(initial);
  const [busy, setBusy] = useState<"sign-in" | "sign-out" | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const refresh = useRef<AbortController | null>(null);

  async function checkAccount() {
    if (lock.current) return;
    refresh.current?.abort();
    const controller = new AbortController();
    refresh.current = controller;
    setChecking(true);
    try {
      const response = await fetch("/api/account", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!controller.signal.aborted) setAccount(result.data);
    } catch {
      if (!controller.signal.aborted) setAccount({ status: "unavailable" });
    } finally { if (!controller.signal.aborted) setChecking(false); }
  }

  useEffect(() => {
    const restore = () => { void checkAccount(); };
    const historyRestore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        lock.current = false;
        setBusy(null);
        setError(null);
      }
      restore();
    };
    const hide = () => { refresh.current?.abort(); setChecking(true); };
    // Recheck on mount too: client navigation can restore an older server payload.
    // History and focus checks also catch sign-out in another tab.
    restore();
    window.addEventListener("pageshow", historyRestore);
    window.addEventListener("pagehide", hide);
    window.addEventListener("focus", restore);
    return () => {
      window.removeEventListener("pageshow", historyRestore);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("focus", restore);
      refresh.current?.abort();
    };
  }, []);

  async function act(kind: "sign-in" | "sign-out") {
    if (lock.current) return;
    lock.current = true;
    refresh.current?.abort();
    setChecking(false);
    setBusy(kind);
    setError(null);
    try {
      if (kind === "sign-out") {
        const result = await auth.signOut();
        if (result.error) throw new Error();
        // Full navigation discards private React state and reloads the session.
        window.location.replace("/auth/sign-in?notice=signed-out");
      } else {
        const query = intended ? `?${new URLSearchParams({ returnTo: intended })}` : "";
        const result = await auth.signIn.social({
          provider: "google",
          callbackURL: `/auth/complete${query}`,
          errorCallbackURL: signInLocation("provider", intended),
        });
        if (result.error || !result.data?.url) throw new Error();
        // The SDK performs the OAuth navigation. Keep the control locked until unload.
      }
    } catch {
      setError(kind === "sign-out"
        ? "Sign-out could not be confirmed. Your session may still be active. Please try again."
        : "Google sign-in could not be started. Please try again.");
      setBusy(null);
      lock.current = false;
    }
  }

  function button(kind: "sign-in" | "sign-out", label: string) {
    const text = busy === kind ? (kind === "sign-in" ? "Connecting to Google..." : "Signing out...") : label;
    return <button className={`action ${kind === "sign-in" ? "action-primary" : ""}`}
      type="button" disabled={Boolean(busy) || checking} onClick={() => void act(kind)}>
      <span className="action-label">{text}</span>
      <span className="action-label-hover" aria-hidden="true">{text}</span>
    </button>;
  }

  const signedIn = account.status === "signed-in";
  return <section className="account-page" aria-labelledby="account-heading">
    <div className="plated"><div className="home-panel account-panel">
      <p className="eyebrow">LOGOS / ACCOUNT</p>
      <h1 id="account-heading">{signedIn ? "Your LOGOS account" : "Sign in to LOGOS"}</h1>
      <p className="muted">Use your verified <strong>@tokyois.com</strong> Google account.</p>
      <div aria-live="polite" aria-busy={Boolean(busy) || checking}>
        {checking ? <p role="status">Checking your session...</p> : <>
          {signedIn ? <>
            <p className="account-email">{account.user.email}</p>
            {intended && notice !== "signed-out" ? <p className="notice">Your requested destination is unavailable or you do not have access. You can stay here or return to the public website.</p> : null}
            <ul className="account-destinations">{accountDestinations(account.user, account.hasApplication).map(label =>
              <li key={label}>{label === "Apply" || label === "View application" ? <ActionLink href="/apply">{label}</ActionLink> : label === "Open dashboard" ? <ActionLink href="/dashboard">{label}</ActionLink> : label === "Leadership controls" ? <ActionLink href="/admin">{label}</ActionLink> : <strong>{label}</strong>}</li>)}</ul>
            {account.hasApplication === null ? <p role="status">Your application status is unavailable. Retry to load your destinations.</p> : null}
            <div className="account-actions">{button("sign-out", "Sign out")}{account.hasApplication === null ? <button className="action" onClick={() => void checkAccount()}>Retry status</button> : null}</div>
          </> : account.status === "unconfigured" ?
            <p className="notice" role="status">Sign-in is not configured for this environment yet.</p>
          : <>
            {account.status === "denied" ? <p className="notice" role="alert">{account.code === "IDENTITY_CONFLICT"
              ? "Your account needs administrator reconciliation. Contact LOGOS leadership before trying again."
              : account.code === "GOOGLE_VERIFICATION_REQUIRED"
                ? "Google verification could not be completed. Sign out, then sign in with your school Google account again."
                : "School account access was denied. A verified @tokyois.com Google account with enabled school access is required."}</p>
              : account.status === "unavailable" ? <p className="notice" role="alert">Your session could not be checked. Please retry.</p>
              : notice === "provider" ? <p className="notice" role="alert">Google sign-in was cancelled or could not be completed. Please try again.</p>
              : notice === "verification" ? <p className="notice" role="alert">Your account could not be verified. Please try signing in again.</p>
              : notice === "signed-out" ? <p role="status">You are signed out.</p> : null}
            <div className="account-actions">
              {account.status === "anonymous" ? button("sign-in", "Continue with Google") : <>
                <button className="action" disabled={Boolean(busy)} onClick={() => void checkAccount()}>Retry session</button>
                {button("sign-out", "Sign out")}
              </>}
            </div>
          </>}
        </>}
      </div>
      {busy ? <p role="status" className="small muted">{busy === "sign-in" ? "Opening Google sign-in..." : "Ending your session..."}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <p className="small muted">Signing in does not create a membership or grant administrator access.</p>
      <ActionLink href="/" variant="outline">Return home</ActionLink>
    </div></div>
  </section>;
}
