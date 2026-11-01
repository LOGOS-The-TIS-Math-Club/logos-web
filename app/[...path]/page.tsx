import Link from "next/link";
import { notFound } from "next/navigation.js";
const destinations: Record<string, string> = {
  about: "About",
  story: "Story",
  meetings: "Meetings",
  join: "Join",
  privacy: "Privacy",
  members: "Members",
  apply: "Apply",
  "auth/sign-in": "Sign in",
};
export default async function PendingPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const title = destinations[path.join("/")];
  if (!title) notFound();
  return (
    <section className="preview">
      <p className="eyebrow">LOGOS / INTERFACE PREVIEW</p>
      <h1>{title}</h1>
      <p className="intro">This page is awaiting frontend integration.</p>
      <div className="notice">
        <p>
          {title === "Sign in"
            ? "Google sign-in is not available in this preview. Live sign-in, account linking, and session restoration remain unverified."
            : "This destination will be implemented and reviewed separately. It is not available in this local preview."}
        </p>
      </div>
      <Link className="back-link" href="/">
        ← Return home
      </Link>
    </section>
  );
}
