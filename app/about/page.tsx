import type { Metadata } from "next";

import { PageBanner } from "@/components/layout/page-banner";
import { CONTACT_EMAIL } from "@/content/club";
import { ActionLink } from "@/components/ui/action";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "LOGOS is the student-led mathematics club of Tokyo International School, founded in early 2025 as the school’s first fully student-driven club.",
};

/*
 * Every statement here is drawn from the club’s Foundational Charter
 * (logos-doc-root). Section references are kept in comments so a future editor
 * can check the wording against the source rather than trusting this page.
 */

// Charter section 2.
const VALUES = [
  {
    name: "Rigor",
    body: "Ideas, arguments and decisions are developed with precision, logical coherence and sufficient justification — held to a standard proportionate to what is at stake.",
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
    <div className="space-y-24 sm:space-y-32">
      <PageBanner
        scene="mark"
        theme="ascii-theme-amber"
        titleId="about-title"
        eyebrow="About the club"
        title={
          <>
            The first fully
            <br />
            student-run club at TIS.
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

      {/* ---------------- Purpose ---------------- */}
      <Reveal as="section" aria-labelledby="purpose-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">Purpose</p>
            <h2
              id="purpose-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              Why the club exists.
            </h2>
          </div>

          <div className="space-y-6">
            <p className="text-xl leading-relaxed text-balance">
              LOGOS exists to cultivate rigorous logical thought and deep
              rational reasoning through the disciplined study and practice of
              mathematics.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              That purpose covers precision in analysis, coherence in argument,
              soundness in judgement and independence in thought. Mathematics is
              both the club’s field of inquiry and the means through which those
              capacities are developed — every programme the club runs has a
              direct and substantive mathematical basis.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---------------- How it runs ---------------- */}
      <Reveal as="section" aria-labelledby="run-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">Governance</p>
            <h2
              id="run-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              Run by its members.
            </h2>
          </div>

          <div className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Governance, administration and direction are principally
              student-led. Students hold primary responsibility for the club’s
              decisions. Teacher supervisors attend and take part in meetings,
              give advice, raise institutional concerns and help the club
              operate — an advisory and supportive role.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              The school and its supervisors may take a stronger role where
              reasonably necessary to protect student safety, preserve
              institutional standards, resolve serious internal disputes, or
              maintain the orderly operation of the club.
            </p>
            <div className="plated max-w-xl">
              <div className="panel-lifted space-y-3 p-7">
                <p className="font-semibold">A written constitution</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The club’s identity, purpose, mission, vision and values are
                  recorded in a Foundational Charter, adopted unanimously by the
                  three founding student leaders. It binds every future
                  leadership team, so the club’s standards survive changes in
                  membership.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------------- Values ---------------- */}
      <Reveal as="section" aria-labelledby="values-heading">
        <div className="space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="eyebrow">Core values</p>
            <h2
              id="values-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-4xl"
            >
              Six commitments, written down.
            </h2>
          </div>

          <ul className="border-border grid gap-px border md:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value, index) => (
              <li
                key={value.name}
                className="bg-surface hover:bg-surface-raised group relative p-7 transition-colors duration-250 motion-reduce:transition-none"
              >
                <span
                  className="datum text-subtle-foreground group-hover:text-primary absolute top-6 right-6 text-xs transition-colors duration-250 motion-reduce:transition-none"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-bold tracking-[-0.01em]">
                  {value.name}
                </h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {value.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* ---------------- Leadership ---------------- */}
      <Reveal as="section" aria-labelledby="leadership-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">Leadership</p>
            <h2
              id="leadership-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              Who runs it.
            </h2>
          </div>
          <div className="space-y-5">
            <p className="text-muted-foreground leading-relaxed">
              LOGOS is led by its student members, with a teacher supervisor in
              an advisory role. Leadership organises sessions, sets the
              programme, and is accountable to the charter.
            </p>
            <p className="text-subtle-foreground text-sm leading-relaxed">
              Named roles are not published here yet.
            </p>

            <div className="plated max-w-md">
              <div className="panel-lifted space-y-3 p-7">
                <p className="eyebrow">Contact</p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="datum link-underline inline-block text-lg break-all"
                >
                  {CONTACT_EMAIL}
                </a>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Or come to Room 101 on a Friday and speak to a member.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal as="section">
        <div className="border-border flex flex-wrap items-center gap-4 border-t pt-10">
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
          <ActionLink href="/meetings">When we meet</ActionLink>
        </div>
      </Reveal>
    </div>
  );
}
