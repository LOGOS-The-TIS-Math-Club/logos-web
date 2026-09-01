import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="mx-auto max-w-4xl space-y-6 text-center sm:space-y-8"
      >
        <div className="border-border bg-surface text-primary inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wide">
          <span>Tokyo International School</span>
          <span aria-hidden="true">•</span>
          <span>High School Math Club</span>
        </div>

        <h1
          id="hero-heading"
          className="text-foreground text-3xl font-bold tracking-tight sm:text-5xl sm:leading-tight"
        >
          Explore Mathematics Beyond the Classroom
        </h1>

        <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed sm:text-lg">
          LOGOS is the student-led math club at TIS. We solve intriguing
          problems, explore contest strategies, and discover mathematical beauty
          together. Prior competition experience is never required.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/apply"
            className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-11 items-center justify-center px-6 py-3 text-base font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            Apply to LOGOS
          </Link>
          <a
            href="#schedule"
            className="border-border bg-surface text-foreground hover:bg-surface-raised rounded-component focus-visible:outline-focus inline-flex min-h-11 items-center justify-center border px-5 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            Meeting Schedule
          </a>
        </div>
      </section>

      {/* What We Do */}
      <section aria-labelledby="activities-heading" className="space-y-6">
        <div className="space-y-1 text-center">
          <h2
            id="activities-heading"
            className="text-foreground text-xl font-bold tracking-tight sm:text-2xl"
          >
            What Students Do
          </h2>
          <p className="text-muted-foreground text-sm">
            Active exploration, peer problem-solving, and collaborative
            learning.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="border-border bg-surface rounded-component border p-6">
            <h3 className="text-primary text-base font-semibold">
              Olympiad Problem Solving
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Tackle creative, non-routine problems across algebra, geometry,
              number theory, and combinatorics with peer discussion.
            </p>
          </div>

          <div className="border-border bg-surface rounded-component border p-6">
            <h3 className="text-primary text-base font-semibold">
              Student-Led Workshops
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Explore fascinating topics outside the standard school syllabus,
              from graph theory and modular arithmetic to mathematical games.
            </p>
          </div>

          <div className="border-border bg-surface rounded-component border p-6">
            <h3 className="text-primary text-base font-semibold">
              Contest Preparation
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Optional training and mock rounds for high school mathematics
              competitions including AMC, AIME, Euclid, and team events.
            </p>
          </div>
        </div>
      </section>

      {/* Eligibility & Meeting Schedule */}
      <section
        id="schedule"
        aria-labelledby="club-details-heading"
        className="border-border bg-surface rounded-component grid grid-cols-1 gap-8 border p-6 sm:p-8 md:grid-cols-2"
      >
        <div className="space-y-4">
          <h2
            id="club-details-heading"
            className="text-foreground text-xl font-bold tracking-tight"
          >
            Who Can Join
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-foreground text-sm font-semibold">
                Eligibility: Grades 9–12
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Open to all Tokyo International School High School students in
                Grades 9, 10, 11, and 12.
              </p>
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                No Prior Contest Experience Required
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Whether you have competed before or are simply curious about
                deep mathematical ideas, LOGOS welcomes your interest.
              </p>
            </div>
          </div>
        </div>

        <div className="border-border space-y-4 border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Meeting Schedule
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Regular Time</dt>
              <dd className="text-foreground font-semibold">
                Every Friday after school, 15:30–16:30
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Location</dt>
              <dd className="text-foreground font-semibold">Room 101</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Format</dt>
              <dd className="text-muted-foreground text-xs leading-relaxed">
                Weekly in-person problem rounds, workshop discussions, and peer
                collaborative sessions.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Why Join */}
      <section aria-labelledby="why-join-heading" className="space-y-6">
        <h2
          id="why-join-heading"
          className="text-foreground text-center text-xl font-bold tracking-tight sm:text-2xl"
        >
          Why Join LOGOS?
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="border-border bg-surface-raised rounded-component border p-5">
            <h3 className="text-foreground text-sm font-semibold">
              Deepen Intuition
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Move past rote formulas and develop genuine mathematical reasoning
              and insight.
            </p>
          </div>

          <div className="border-border bg-surface-raised rounded-component border p-5">
            <h3 className="text-foreground text-sm font-semibold">
              Collaborative Community
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Work alongside fellow students who share your curiosity for
              intellectual challenges.
            </p>
          </div>

          <div className="border-border bg-surface-raised rounded-component border p-5">
            <h3 className="text-foreground text-sm font-semibold">
              Learn at Your Own Pace
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Engage with problems matched to your current level while exploring
              advanced concepts.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        aria-labelledby="cta-heading"
        className="border-border bg-surface rounded-component border p-8 text-center sm:p-12"
      >
        <div className="mx-auto max-w-xl space-y-4">
          <h2
            id="cta-heading"
            className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Ready to apply?
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The application takes under 5 minutes. Identify with your verified
            Tokyo International School account to submit your application.
          </p>
          <div className="pt-2">
            <Link
              href="/apply"
              className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-11 items-center justify-center px-6 py-3 text-base font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              Start Application
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
