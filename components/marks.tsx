import type { SVGProps } from "react";

/*
 * Official LOGOS marks.
 *
 * Geometry is reproduced exactly from logos-brandmark (logomark.svg,
 * wordmark.svg, combination-mark-1.svg). Nothing is redrawn, rescaled
 * unevenly, or rearranged.
 *
 * The one change from the source files is colour binding: the hard-coded
 * #2a212c is replaced with `currentColor` so a single mark renders correctly on
 * both the dark interface ground and light or print contexts. Proportions,
 * stroke weight, and clear space are untouched.
 */

/** Brand ink from the official files. Use on light grounds and in print. */
export const BRAND_INK = "#2a212c";

const CIRCLES = [
  { cx: 150, cy: 150 },
  { cx: 198, cy: 198 },
  { cx: 102, cy: 102 },
  { cx: 102, cy: 198 },
  { cx: 198, cy: 102 },
] as const;

/**
 * Five circles in a quincunx. Radius and stroke are 32% and 4% of the mark box,
 * matching every official export.
 */
export function LogosLogomark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 300 300"
      fill="none"
      stroke="currentColor"
      strokeWidth={12}
      strokeMiterlimit={10}
      {...props}
    >
      {CIRCLES.map((circle) => (
        <circle key={`${circle.cx}-${circle.cy}`} {...circle} r={96} />
      ))}
    </svg>
  );
}

const WORDMARK_PATHS = [
  "M0,1.7h20.68v177.76h109.56v17.89H0V1.7Z",
  "M120.91,99.53C120.91,42.51,164.51.03,223.76.03s102.58,42.2,102.58,99.5-43.88,99.5-102.58,99.5-102.86-42.48-102.86-99.5ZM305.66,99.53c0-46.68-34.94-81.06-81.89-81.06s-82.45,34.38-82.45,81.06,35.22,81.06,82.45,81.06,81.89-34.38,81.89-81.06Z",
  "M340.84,99.53C340.84,42.23,384.44.03,444.26.03c29.63,0,55.34,9.5,72.67,28.23l-12.86,13.14c-16.49-16.21-36.06-22.92-58.98-22.92-48.35,0-83.85,34.38-83.85,81.06s35.5,81.06,83.57,81.06c18.73,0,36.06-4.19,51.15-15.37v-65.68h19.84v74.63c-18.45,16.49-44.72,24.88-71.83,24.88-59.53,0-103.14-42.2-103.14-99.5Z",
  "M537.97,99.53C537.97,42.51,581.57.03,640.82.03s102.58,42.2,102.58,99.5-43.88,99.5-102.58,99.5-102.86-42.48-102.86-99.5ZM722.72,99.53c0-46.68-34.94-81.06-81.9-81.06s-82.45,34.38-82.45,81.06,35.22,81.06,82.45,81.06,81.9-34.38,81.9-81.06Z",
  "M754.38,173.6l8.11-15.93c13.98,13.69,38.85,23.76,64.57,23.76,36.61,0,52.55-15.37,52.55-34.66,0-53.66-120.46-20.68-120.46-93.07C759.13,24.9,781.49.03,831.24.03c22.08,0,45,6.43,60.65,17.33l-6.99,16.49c-16.77-10.9-36.33-16.21-53.66-16.21-35.78,0-51.71,15.93-51.71,35.5,0,53.66,120.46,21.24,120.46,92.51,0,28.79-22.92,53.38-72.95,53.38-29.35,0-58.14-10.34-72.67-25.43Z",
] as const;

function WordmarkGlyphs() {
  return (
    <>
      <rect x="548.8" y="90.58" width="183.81" height="17.89" />
      <rect
        x="85.67"
        y="89.73"
        width="261.21"
        height="17.89"
        transform="translate(-6.43 181.83) rotate(-45)"
      />
      {WORDMARK_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </>
  );
}

/** The LOGOS wordmark alone. */
export function LogosWordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 900 200" fill="currentColor" {...props}>
      <WordmarkGlyphs />
    </svg>
  );
}

/**
 * Horizontal lockup. The translate reproduces combination-mark-1.svg exactly:
 * the wordmark group sits at (380, 50.49) inside a 1280x300 box.
 */
export function LogosLockup(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 1280 300" fill="none" {...props}>
      <g
        stroke="currentColor"
        strokeWidth={12}
        strokeMiterlimit={10}
        fill="none"
      >
        {CIRCLES.map((circle) => (
          <circle key={`${circle.cx}-${circle.cy}`} {...circle} r={96} />
        ))}
      </g>
      <g transform="translate(380 50.49)" fill="currentColor">
        <WordmarkGlyphs />
      </g>
    </svg>
  );
}

/**
 * Small-size logomark.
 *
 * At 16-24px the official 4% stroke collapses into a smudge, so this variant
 * thickens the stroke and pulls the circles in slightly to keep the quincunx
 * readable. Geometry is otherwise the official construction. Use ONLY below
 * 32px; every larger context uses LogosLogomark.
 */
export function LogosLogomarkCompact(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 300 300"
      fill="none"
      stroke="currentColor"
      strokeWidth={26}
      strokeMiterlimit={10}
      {...props}
    >
      {CIRCLES.map((circle) => (
        <circle
          key={`${circle.cx}-${circle.cy}`}
          cx={150 + (circle.cx - 150) * 0.78}
          cy={150 + (circle.cy - 150) * 0.78}
          r={88}
        />
      ))}
    </svg>
  );
}
