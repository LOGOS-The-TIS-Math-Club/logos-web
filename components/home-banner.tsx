import { ActionLink } from "./action.tsx";
import { PageBanner } from "./page-banner.tsx";

export function HomeBanner() {
  return (
    <PageBanner
      scene="collapse"
      waveSurface
      theme="ascii-theme-violet"
      titleId="hero-heading"
      eyebrow="Tokyo International School · Grades 9-12"
      title={
        <>
          Mathematics,
          <br />
          taken seriously.
        </>
      }
      subtitle="The student-led mathematics club of Tokyo International School."
      actions={
        <>
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
          <ActionLink href="/about">About the club</ActionLink>
        </>
      }
    />
  );
}
