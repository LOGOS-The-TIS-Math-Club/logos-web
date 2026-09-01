"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function cookie(name: string): string {
  return (
    document.cookie
      .split("; ")
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

async function mutate(path: string) {
  return fetch(path, {
    method: "POST",
    headers: {
      "X-CSRF-Token": decodeURIComponent(cookie("__Host-logos_csrf")),
      "X-Session-CSRF-Token": decodeURIComponent(
        cookie("__Host-logos_session_csrf"),
      ),
    },
  });
}

export function SignInButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            const response = await mutate("/api/auth/google/start");
            const data = (await response.json()) as { url?: string };
            if (!response.ok || !data.url) throw new Error("Unavailable");
            window.location.assign(data.url);
          } catch {
            setFailed(true);
            setBusy(false);
          }
        }}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-component px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      {failed ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          Sign-in is unavailable. Please try again later.
        </p>
      ) : null}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/session-csrf", { cache: "no-store" });
        await mutate("/api/auth/logout");
        router.push("/auth/sign-in");
        router.refresh();
      }}
      className="border-border hover:bg-secondary rounded-component border px-4 py-2 text-sm font-semibold"
    >
      Sign out
    </button>
  );
}
