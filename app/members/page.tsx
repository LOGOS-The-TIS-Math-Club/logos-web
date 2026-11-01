import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionLink } from "../../components/action.tsx";
import { ContentImage } from "../../components/content-image.tsx";
import { getPublishedLeadership } from "../../src/content/operations.ts";
import { readPublic } from "../../src/content/public-read.ts";
import { getDatabase } from "../../src/server/database.ts";

export const metadata: Metadata = {
  title: "Members",
  description: "The people behind LOGOS: founders, student leadership, and the club supervisor.",
};

async function People({ content }: {
  content: ReturnType<typeof readPublic<Awaited<ReturnType<typeof getPublishedLeadership>>>>;
}) {
  const result = await content;
  if (result.status === "unavailable") return (
    <div className="home-rule"><p className="muted">People profiles are temporarily unavailable. Please try again later.</p><a className="home-text-link" href="/members">Reload profiles</a></div>
  );
  if (!result.data.length) return <p className="home-rule muted">Named profiles have not been published yet.</p>;
  return <ul className="people-list">{result.data.map(person => (
    <li key={person.id} className="plated"><article className="home-panel" aria-labelledby={`person-${person.id}`}>
      <p className="eyebrow">{person.title}</p>
      <h3 id={`person-${person.id}`}>{person.display_name}</h3>
      {person.image_id ? <ContentImage id={person.image_id} alt={person.display_name} width={null} height={null} unavailableMessage="Profile image unavailable." /> : null}
      {person.biography.trim() ? <p className="muted person-biography">{person.biography}</p> : null}
    </article></li>
  ))}</ul>;
}

export default function MembersPage() {
  const content = readPublic(() => getPublishedLeadership(getDatabase()));
  return (
    <div className="public-info-page">
      <div className="info-intro"><p className="eyebrow">Members</p><h1>The people behind LOGOS.</h1><p className="intro muted">Founders, current student leadership, and the club supervisor.</p></div>
      <section aria-labelledby="people-heading">
        <h2 id="people-heading">Who runs it.</h2>
        <p className="muted">LOGOS is led by its student members, with a teacher supervisor in an advisory role. Leadership organises sessions, sets the programme, and is accountable to the charter.</p>
        <Suspense fallback={<p className="home-loading" role="status">Loading people profiles…</p>}><People content={content} /></Suspense>
      </section>
      <section aria-labelledby="contact-heading"><div className="plated"><div className="home-panel"><h2 id="contact-heading">Get in touch.</h2><a className="home-text-link" href="mailto:mathclub@tokyois.com">mathclub@tokyois.com</a></div></div></section>
      <div className="public-page-actions"><ActionLink href="/about">About LOGOS</ActionLink><ActionLink href="/story">Our history</ActionLink></div>
    </div>
  );
}
