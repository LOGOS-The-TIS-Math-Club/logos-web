import type { Metadata } from "next";
import { ActionLink } from "../../components/action.tsx";

export const metadata: Metadata = {
  title: "Data and privacy",
  description: "Information used for LOGOS applications and club administration, public profiles, and privacy enquiries.",
};
const collected = [
  "Preferred name, grade, and academic year",
  "Mathematical interests, reasons for joining, and goals",
  "Optional experience and current maths course",
  "Interest in contests and presenting",
  "Ability to attend regularly and confirmation that answers are accurate",
];
export default function PrivacyPage() {
  return (
    <div className="public-info-page">
      <div className="info-intro">
        <p className="eyebrow">Data and privacy</p>
        <h1>Your information at LOGOS.</h1>
        <p className="intro muted">Information used to review applications and administer the club.</p>
        <p className="info-note muted">Applications, sign-in, and member services are not available in this public preview. This page describes the records and access rules supported by the existing backend.</p>
      </div>
      <section aria-labelledby="collected-heading">
        <p className="eyebrow">01 / Applications</p>
        <h2 id="collected-heading">What the application asks for</h2>
        <div className="plated"><div className="home-panel">
          <ul className="info-list">{collected.map(item => <li key={item}>{item}</li>)}</ul>
          <p className="muted">There are no dedicated fields for home addresses, phone numbers, medical information, guardian details, marks, or transcripts. Please keep those details out of free-text answers.</p>
        </div></div>
      </section>
      <section aria-labelledby="identity-heading">
        <p className="eyebrow">02 / School identity</p>
        <h2 id="identity-heading">School sign-in and membership</h2>
        <p className="muted">The sign-in integration uses Google through Neon Auth. The backend checks a verified school email address and Google account identity. It stores the school email address, Google account identifier, and authentication account identifier to associate records with the same person.</p>
        <p className="muted">The LOGOS application form does not ask for your Google password. Signing in does not itself grant membership or administrator access. Live sign-in and account restoration have not yet been verified for this preview.</p>
      </section>
      <section aria-labelledby="access-heading">
        <p className="eyebrow">03 / Club records</p>
        <h2 id="access-heading">Private records and public content</h2>
        <p className="muted">The backend restricts application access to the applicant and explicitly authorised administrators. Membership, attendance, absence notices, and administrative notes have separate access rules. A public club title does not grant administrative permissions.</p>
        <p className="muted">Public pages do not display application answers, attendance, absence notices, private member identities, or administrative notes. People profiles are separate published content: a display name, role, biography, and image may be shown when a profile is published.</p>
        <p className="muted">Public meeting information is limited to the latest completed session’s title and description and the current term’s non-cancelled session titles. Session dates, locations, and materials remain private. Access to Google Drive files is controlled separately by Google Drive permissions.</p>
      </section>
      <section aria-labelledby="analytics-heading">
        <h2 id="analytics-heading">Website analytics</h2>
        <p className="muted">We use Vercel Web Analytics to count visits to public information pages. The site excludes application, sign-in, member, and leadership pages from page view tracking.</p>
      </section>
      <section aria-labelledby="requests-heading">
        <p className="eyebrow">04 / Questions and requests</p>
        <h2 id="requests-heading">Corrections, withdrawal, and deletion</h2>
        <div className="plated"><div className="home-panel">
          <p className="muted">For questions or requests about your information, contact <a className="home-text-link" href="mailto:mathclub@tokyois.com">mathclub@tokyois.com</a> or the club supervisor through the school.</p>
          <p className="muted">Withdrawing an application changes its status. It does not automatically erase the application or its history. Retention periods and the process for handling deletion requests still need to be confirmed before member services launch.</p>
        </div></div>
      </section>
      <div className="public-page-actions"><ActionLink href="/join">About joining</ActionLink><ActionLink href="/members">People behind LOGOS</ActionLink></div>
    </div>
  );
}
