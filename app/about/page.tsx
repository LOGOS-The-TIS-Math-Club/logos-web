import type { Metadata } from "next";
import { PageBanner } from "../../components/page-banner.tsx";
import { RevealSection } from "../../components/reveal-section.tsx";
import { ActionLink } from "../../components/action.tsx";

export const metadata: Metadata = {
  title: "About",
  description:
    "LOGOS is the student-led mathematics club of Tokyo International School, founded in early 2025 as the school’s first fully student-driven club.",
};

// Charter-based copy reused from the legacy About page.
// Charter section 2.
const VALUES = [
  {
    name: "Rigor",
    body: "Ideas, arguments and decisions are developed with precision, logical coherence and sufficient justification, held to a standard proportionate to what is at stake.",
  },
  {
    name: "Integrity",
    body: "Honesty and accountability in academic work and in how the club represents itself. We correct information we find to be wrong.",
  },
  {
    name: "Ownership",
    body: "Members accept responsibility for their commitments and follow through, without avoidable reliance on others.",
  },
  {
    name: "Discipline",
    body: "Consistent effort and adherence to standards, including when motivation or convenience is absent.",
  },
  {
    name: "Collaboration",
    body: "Knowledge and effort combined toward shared aims, with disagreement expressed without losing academic seriousness.",
  },
  {
    name: "Resilience",
    body: "Persistence through difficulty, and constructive response when an approach proves insufficient.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="about-page">
      <PageBanner
        className="about-banner"
        scene="mark"
        theme="ascii-theme-sand"
        titleId="about-title"
        eyebrow="About the club"
        title={
          <>
            The first fully student-led
            <br />
            <span className="keep-together">club at TIS.</span>
          </>
        }
        subtitle="Founded in early 2025 as a student-led academic organisation of Tokyo International School."
        actions={
          <>
            <ActionLink href="/join" variant="primary">
              Who can join
            </ActionLink>
            <ActionLink href="/meetings">When we meet</ActionLink>
          </>
        }
      />
      <RevealSection className="home-section" aria-labelledby="purpose-heading">
        <div>
          <p className="eyebrow">Purpose</p>
          <h2 id="purpose-heading">Why the club exists.</h2>
        </div>
        <div className="about-prose">
          <p className="about-lead">
            LOGOS exists to cultivate rigorous logical thought and deep rational
            reasoning through the disciplined study and practice of mathematics.
          </p>
          <p className="muted">
            That purpose covers precision in analysis, coherence in argument,
            soundness in judgement and independence in thought. Mathematics is
            both the club’s field of inquiry and the means through which those
            capacities are developed. Every programme the club runs has a direct
            and substantive mathematical basis.
          </p>
        </div>
      </RevealSection>
      <RevealSection className="home-section" aria-labelledby="run-heading">
        <div>
          <p className="eyebrow">Governance</p>
          <h2 id="run-heading">Run by its members.</h2>
        </div>
        <div className="about-prose">
          <p className="muted">
            Governance, administration and direction are principally
            student-led. Students hold primary responsibility for the club’s
            decisions. Teacher supervisors attend and take part in meetings,
            give advice, raise institutional concerns and help the club operate
            in an advisory and supportive role.
          </p>
          <p className="muted">
            The school and its supervisors may take a stronger role where
            reasonably necessary to protect student safety, preserve
            institutional standards, resolve serious internal disputes, or
            maintain the orderly operation of the club.
          </p>
          <div className="plated about-charter">
            <div className="home-panel">
              <h3>A written constitution</h3>
              <p className="muted">
                The club’s identity, purpose, mission, vision and values are
                recorded in a Foundational Charter, adopted unanimously by the
                three founding student leaders. It binds every future leadership
                team, so the club’s standards survive changes in membership.
              </p>
            </div>
          </div>
        </div>
      </RevealSection>
      <RevealSection aria-labelledby="values-heading">
        <div className="values-heading">
          <p className="eyebrow">Core values</p>
          <h2 id="values-heading">Six commitments, written down.</h2>
        </div>
        <ul className="values-grid">
          {VALUES.map((value, index) => (
            <li key={value.name}>
              <span className="value-number datum" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{value.name}</h3>
              <p className="muted">{value.body}</p>
            </li>
          ))}
        </ul>
      </RevealSection>
      <RevealSection
        className="home-section"
        aria-labelledby="leadership-heading"
      >
        <div>
          <p className="eyebrow">Leadership</p>
          <h2 id="leadership-heading">Who runs it.</h2>
        </div>
        <div className="about-prose">
          <p className="muted">
            LOGOS is led by its student members, with a teacher supervisor in an
            advisory role. Leadership organises sessions, sets the programme,
            and is accountable to the charter.
          </p>
          <p className="small muted">Named roles are not published here yet.</p>
          <div className="plated about-contact">
            <div className="home-panel">
              <p className="eyebrow">Contact</p>
              <a
                className="home-text-link contact-email"
                href="mailto:mathclub@tokyois.com"
              >
                mathclub@tokyois.com
              </a>
              <p className="muted">
                Or come to Room 101 on a Friday and speak to a member.
              </p>
            </div>
          </div>
        </div>
      </RevealSection>
      <RevealSection className="about-actions" aria-label="Explore LOGOS">
        <ActionLink href="/apply" variant="primary">
          Apply to LOGOS
        </ActionLink>
        <ActionLink href="/meetings">When we meet</ActionLink>
      </RevealSection>
    </div>
  );
}
