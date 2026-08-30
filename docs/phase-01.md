# Phase 01 - Interface and Design-System Foundation

> - Status: In progress
> - Roadmap: [roadmap.md](./roadmap.md)
> - Architecture: [architecture.md](./architecture.md)
> - Predecessor: [phase-00.md](./phase-00.md)
> - Successor: phase-02.md
> - First release target: `0.1.0`
> - Unreleased manifest version: `0.0.0`
> - Last updated: 2026-08-30

## 1. Objective

Establish a responsive, accessible application shell and reusable interface foundation for LOGOS Web following the approved Mauve Precision design direction. The phase defines a dark-first, dark-only semantic design token system backed exclusively by the official Tailwind CSS color palette, introduces lightweight and meticulously polished accessible UI primitives, establishes route-level loading, error, and not-found states, and proves responsive and keyboard navigation behaviors across target viewports without introducing database, authentication, or external provider dependencies. Future light mode is explicitly deferred.

## 2. Design Gate Status and Approval Record

The design gate for Phase 01 is approved. The user has reviewed provisional proposals, explicitly rejected previous alternatives, and approved the Mauve Precision direction.

With the design gate resolved, Phase 01 status is set to Ready. This status confirms that design choices are settled and the execution plan is authorized. It does not claim that implementation has started or completed.

Implementation of visual styles, Tailwind tokens, component primitives, and shell layouts must adhere strictly to the approved Mauve Precision specifications defined in this document.

## 3. Architecture References and Authority

This plan is governed by the project planning hierarchy:

1. `architecture.md` defines system-wide invariants, technology choices, and provider boundaries.
2. `roadmap.md` defines phase sequencing, dependencies, and broad completion gates.
3. `phase-01.md` defines the execution plan, approved Mauve Precision design direction, token inventory, and acceptance gates for Phase 01.

Specific architectural anchors from `architecture.md` governing this phase include:

- Section 2 (Architectural drivers): Security and privacy, simplicity (club scale of approximately 20 members), maintainability, low-cost operation, and accessibility targeting WCAG 2.2 AA across devices and input methods.
- Section 5 (Technology baseline): Next.js App Router, React Server Components by default, strict TypeScript, Node.js 24 LTS, pnpm, Tailwind CSS as the styling foundation, selective shadcn/ui primitives, Vitest, React Testing Library, and Playwright.
- Section 14 (Frontend and design foundation): The official Tailwind CSS color palette is the mandatory raw color vocabulary. Semantic tokens (`background`, `foreground`, `surface`, `primary`, `secondary`, `muted`, `border`, `focus`, `success`, `warning`, `danger`, `info`) must map to official Tailwind palette values. Color never serves as the only indicator of status. Every token pair must meet WCAG 2.2 AA contrast. Visible keyboard focus, accessible names, and responsive behavior are required from the start.
- Section 15 (Next.js implementation conventions): App Router is mandatory. React Server Components are the default; client components are introduced only for browser interaction or client state.
- Section 17 (Deployment, environments, and regions): Singapore dynamic function region (`sin1`), access-protected Vercel Preview deployments, and dormant Production branch (`production-disabled-until-phase-11`).
- Section 18 (Testing and release gates): Accessible UI behavior, risk-based coverage, Playwright smoke suite, and CI quality gates.
- Section 20 (Cost, scale, and portability): Free-tier alignment (Vercel Hobby, GitHub Free) and zero-cost operation.
- Section 22 (Explicitly deferred decisions): Exact LOGOS Tailwind colors, semantic token values, and typography for dark-only operation are resolved by this phase specification. Light-mode theming, public imagery, and later domain workflows remain deferred.

## 4. Scope and Non-Goals

### 4.1 In-Scope Deliverables

- Approved Mauve Precision design specification and semantic token architecture.
- Explicit rejected-directions record documenting the rejection of previous provisional options and generic styling.
- Semantic token architecture defining CSS custom properties mapped exclusively to official Tailwind CSS palette values (Tailwind theme variables) for dark-first, dark-only operation in Phase 01.
- Lightweight, meticulously polished UI primitive inventory: Container, SkipLink, Button, StatusBadge, and Shell layout.
- Shape system enforcing a disciplined 6px component radius, pill radius exclusively for status badges, and an explicit ban on large rounded cards.
- Design dials calibrated to DESIGN_VARIANCE 6, MOTION_INTENSITY 2, and VISUAL_DENSITY 4.
- Explicit deferral of future light mode; no automatic light/dark behavior and no theme toggle in Phase 01.
- Explicit prohibition of gradients, glassmorphism, glow, excessive effects, decorative animation, generic dashboard styling, bulky component-library styling, and imagery.
- Route-level status templates: `app/loading.tsx`, `app/error.tsx`, and `app/not-found.tsx`.
- Typography baseline using system sans font stacks without external network fetches or runtime font requests.
- Spacing, sizing, and touch target conventions based on a 4px baseline grid.
- Keyboard navigation, visible focus indicators (violet-300), and reduced-motion rules.
- WCAG 2.2 AA accessibility requirements, verified contrast evidence, and the rule that color is never the only status indicator.
- Dependency evaluation recording that shadcn/ui remains unnecessary for this minimal primitive set.
- Vitest and React Testing Library component test suite.
- Playwright Chromium end-to-end test suite verifying landmarks, skip link, viewports, zero horizontal overflow, reduced motion, security headers, and contrast.
- Preservation of baseline security headers in `proxy.ts` and `noindex, nofollow, noarchive` search directives.

### 4.2 Non-Goals

- No light mode implementation, automatic light/dark switching, or theme toggle controls (deferred to a future phase).
- No imagery, photography, illustration assets, or icon font libraries (deferred to Phase 06).
- No gradients, glassmorphism, background blur, glow, or decorative animation effects.
- No bulky component libraries or shadcn/ui installation.
- No database schemas, migrations, PostgreSQL connections, Neon configurations, or Drizzle setup (deferred to Phase 02).
- No authentication flows, Neon Auth, Google OAuth, session cookies, or user authorization checks (deferred to Phase 04).
- No Google Workspace integrations: Google Calendar, Drive, Classroom, or Gmail API (deferred to Phase 05).
- No public content authoring, leadership profiles, announcements, or resource documents (deferred to Phase 06).
- No membership application intake, review workflows, or member directory (deferred to Phase 07).
- No attendance tracking, expected-absence intake, or warning evaluations (deferred to Phase 08).
- No complex interactive controls: dialogs, modal sheets, dropdown menus, popovers, comboboxes, or drawers.
- No external font downloads from Google Fonts, Adobe Fonts, or third-party CDNs.
- No client-side analytics or tracking scripts.
- No user file uploads or media pipelines.
- No production Vercel deployment or mapping of `tislogos.org` (dormant until Phase 11).
- No real student records or non-synthetic data.

## 5. Approved Design Direction: Mauve Precision

Phase 01 operates under the approved Mauve Precision design direction.

### 5.1 Aesthetic Character and Principles

- Character: Sleek, very modern, deliberate, restrained, and premium.
- Atmosphere: Dark-first and dark-only. The interface presents a deep, focused canvas using the Tailwind Zinc neutral family, punctuated by a refined mauve accent mapped strictly to Tailwind violet values.
- Component philosophy: Lightweight, meticulously polished components with minimal structural DOM. Avoids the heavy, padded look of generic component libraries or administrative templates.
- Visual purity: Strictly no gradients, no glassmorphism, no backdrop blurs, no ambient glows, no heavy drop shadows, no decorative animations, and no imagery.
- Distinction: Rejects the predictable blue tones of academic institutions, generic SaaS styling, and generic-template styling.

### 5.2 Design Dials

The design dials calibrate the visual tone on a 1 to 10 scale:

- `DESIGN_VARIANCE: 6` (Measured asymmetry, deliberate layout variety, structured editorial balance)
- `MOTION_INTENSITY: 2` (Nearly static, functional state transitions only, zero decorative animation)
- `VISUAL_DENSITY: 4` (Comfortable breathing room, spacious layouts without sparse emptiness)

### 5.3 Shape System

- Component radius: 6px (`rounded-[6px]`) applied consistently to buttons, inputs, structural panels, and cards.
- Badge radius: Pill shape (`rounded-full`) reserved exclusively for inline status badges (`StatusBadge`).
- Prohibited shapes: Large rounded cards (such as `rounded-2xl` or `rounded-3xl`) are prohibited to maintain a crisp, architectural structure.

### 5.4 Theme Scope and Deferral

- Dark-only in Phase 01: The interface renders exclusively in dark mode.
- No automatic light/dark switching: The application does not track `prefers-color-scheme` to switch themes.
- No theme toggle: No client-side toggle controls or theme providers are shipped in Phase 01.
- Future light mode deferred: A corresponding light mode is documented as deferred to a future phase.

### 5.5 Rejected Directions Record

The user explicitly reviewed and rejected the following directions:

1. Direction 1: Euclidean Institute (Slate neutral, Blue accent)
   - Rejection rationale: Rejected for its conventional blue-academic institutional tone, rigid cartesian framing, and generic collegiate feel.
2. Direction 2: Modern Precision (Zinc neutral, Teal accent)
   - Rejection rationale: Rejected for its generic SaaS software feel, utility dashboard appearance, and startup product tropes.
3. Direction 3: Scholastic Monograph (Stone neutral, Indigo accent)
   - Rejection rationale: Rejected for its archival paper aesthetic, serif typography, and lack of modern digital precision.
4. Generic-template and component-library styling:
   - Rejection rationale: Explicitly rejected bulky pre-built component styles, heavy gradients, glassmorphism, decorative glows, and bloated utility patterns.

## 6. Semantic Token Inventory and Architecture

### 6.1 Token Rules

- All semantic tokens are implemented via CSS custom properties mapped exclusively to the official Tailwind CSS color palette.
- Implementation must reference Tailwind palette variables rather than duplicate arbitrary hex values in application CSS or component code.
- Components consume semantic utility classes or CSS custom properties rather than raw palette colors directly.
- The neutral foundation is the Tailwind Zinc family.
- The primary mauve accent is mapped strictly to Tailwind violet values.
- Status tokens are semantic exceptions reserved for functional indicators and feedback, not competing brand accents.
- Color is never the only indicator of status. Every status element must pair color with explicit text labels or accessible structure.
- Every token pairing must satisfy WCAG 2.2 AA contrast requirements:
  - 4.5:1 minimum for normal text (under 18pt/24px or under 14pt/18.66px bold).
  - 3:1 minimum for large text (18pt/24px or larger, or 14pt/18.66px bold or larger).
  - 3:1 minimum for user interface components and graphical boundaries.

### 6.2 Token Definitions and Mappings

| Semantic Token         | Tailwind Variable Mapping                  | Semantic Role and Usage                                                |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `background`           | `zinc-950` (`var(--color-zinc-950)`)       | Primary page canvas and viewport background                            |
| `foreground`           | `zinc-100` (`var(--color-zinc-100)`)       | Primary body text and high-contrast content                            |
| `surface`              | `zinc-900` (`var(--color-zinc-900)`)       | Structural panels, cards, headers, and navigation containers           |
| `surface-raised`       | `zinc-800` (`var(--color-zinc-800)`)       | Elevated sub-panels, secondary containers, and active rows             |
| `primary`              | `violet-300` (`var(--color-violet-300)`)   | Mauve brand accent, primary action button fill, key interactive states |
| `primary-hover`        | `violet-200` (`var(--color-violet-200)`)   | Hover feedback state for primary interactive elements                  |
| `primary-active`       | `violet-400` (`var(--color-violet-400)`)   | Pressed/active feedback state for primary interactive elements         |
| `primary-foreground`   | `zinc-950` (`var(--color-zinc-950)`)       | Text and icon content rendered on primary mauve fills                  |
| `secondary`            | `zinc-800` (`var(--color-zinc-800)`)       | Supporting interactive elements, secondary button fill                 |
| `secondary-foreground` | `zinc-100` (`var(--color-zinc-100)`)       | Text and icon content rendered on secondary fills                      |
| `muted`                | `zinc-800` (`var(--color-zinc-800)`)       | Subdued containers, disabled control fills                             |
| `muted-foreground`     | `zinc-400` (`var(--color-zinc-400)`)       | Subdued text, secondary labels, helper descriptions                    |
| `border`               | `zinc-500` (`var(--color-zinc-500)`)       | Structural rules, dividers, control boundaries satisfying 3:1 contrast |
| `focus`                | `violet-300` (`var(--color-violet-300)`)   | Keyboard focus ring indicator with high visibility against dark canvas |
| `success`              | `emerald-300` (`var(--color-emerald-300)`) | Affirmative notices, confirmed actions, verified badge text            |
| `success-surface`      | `emerald-950` (`var(--color-emerald-950)`) | Subtle background container for success notices and badges             |
| `warning`              | `amber-300` (`var(--color-amber-300)`)     | Cautionary notices, pending verification badge text                    |
| `warning-surface`      | `amber-950` (`var(--color-amber-950)`)     | Subtle background container for warning notices and badges             |
| `danger`               | `rose-300` (`var(--color-rose-300)`)       | Critical alerts, destructive actions, error badge text                 |
| `danger-surface`       | `rose-950` (`var(--color-rose-950)`)       | Subtle background container for danger notices and badges              |
| `info`                 | `sky-300` (`var(--color-sky-300)`)         | Informational callouts, neutral status badge text                      |
| `info-surface`         | `sky-950` (`var(--color-sky-950)`)         | Subtle background container for informational notices and badges       |

### 6.3 Verified Contrast Evidence

All Mauve Precision token combinations have been verified against WCAG 2.2 AA contrast requirements. The verified contrast ratios are:

- `foreground` on `background` (`zinc-100` on `zinc-950`): 18.10:1 (exceeds 4.5:1 text requirement)
- `foreground` on `surface` (`zinc-100` on `zinc-900`): 16.12:1 (exceeds 4.5:1 text requirement)
- `primary` accent on `background` (`violet-300` on `zinc-950`): 10.78:1 (exceeds 4.5:1 text requirement and 3:1 UI requirement)
- `primary` accent on `surface` (`violet-300` on `zinc-900`): 9.60:1 (exceeds 4.5:1 text requirement and 3:1 UI requirement)
- `primary-foreground` on `primary` (`zinc-950` on `violet-300`): 10.78:1 (exceeds 4.5:1 text requirement)
- `muted-foreground` on `muted` / `surface-raised` (`zinc-400` on `zinc-800`): 5.81:1 (exceeds 4.5:1 text requirement)
- `border` on `surface` (`zinc-500` on `zinc-900`): 3.67:1 (exceeds 3:1 graphical boundary requirement)
- Status badge text on status surface:
  - `success` on `success-surface` (`emerald-300` on `emerald-950`): 9.94:1 (exceeds 4.5:1 text requirement)
  - `warning` on `warning-surface` (`amber-300` on `amber-950`): 10.39:1 (exceeds 4.5:1 text requirement)
  - `danger` on `danger-surface` (`rose-300` on `rose-950`): 8.27:1 (exceeds 4.5:1 text requirement)
  - `info` on `info-surface` (`sky-300` on `sky-950`): 8.32:1 (exceeds 4.5:1 text requirement)

### 6.4 Status Token Governance and Color Independence

- Semantic exceptions: Status colors (`emerald`, `amber`, `rose`, `sky`) are strictly functional feedback signals. They must never be used as general branding accents, decorative card borders, or decorative text highlights.
- Color independence: In strict compliance with WCAG 1.4.1, color is never the only status indicator. Status badges, banners, and feedback alerts must always include explicit text labels (such as "Active", "Pending", "Failed") and, where appropriate, accessible icons with `aria-hidden="true"` or accessible descriptions.

## 7. Layout, Typography, Spacing, and Interaction Conventions

### 7.1 System Typography Baseline

- Font stacks: System font stacks only. No web fonts, Google Fonts, Adobe Fonts, or external runtime font requests.
  - Sans stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - Monospace stack (for tabular numbers and timestamps): `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`
  - Serif typography is explicitly excluded.
- Type scale:
  - `text-xs`: 0.75rem (12px), line height 1rem (16px)
  - `text-sm`: 0.875rem (14px), line height 1.25rem (20px)
  - `text-base`: 1rem (16px), line height 1.5rem (24px)
  - `text-lg`: 1.125rem (18px), line height 1.75rem (28px)
  - `text-xl`: 1.25rem (20px), line height 1.75rem (28px)
  - `text-2xl`: 1.5rem (24px), line height 2rem (32px)
  - `text-3xl`: 1.875rem (30px), line height 2.25rem (36px)
- Heading hierarchy:
  - `h1`: 1.875rem to 2.25rem, semibold, line height 1.2, margin-bottom 1rem
  - `h2`: 1.5rem, semibold, line height 1.25, margin-top 2rem, margin-bottom 0.75rem
  - `h3`: 1.25rem, medium, line height 1.3, margin-top 1.5rem, margin-bottom 0.5rem
  - Skipping heading levels is prohibited.

### 7.2 Spacing, Sizing, and Component Principles

- 4px baseline grid following Tailwind default scale (`1` = 4px, `2` = 8px, `3` = 12px, `4` = 16px, `6` = 24px, `8` = 32px, `12` = 48px).
- Containers: Content is constrained to responsive maximum widths:
  - Default layout container: `max-w-5xl` (1024px) or `max-w-7xl` (1280px).
  - Responsive padding: `px-4 sm:px-6 lg:px-8`.
- Component shape rules:
  - 6px radius (`rounded-[6px]`) on buttons, form controls, and panels.
  - Full pill radius (`rounded-full`) on status badges.
  - Large rounded corners (`rounded-xl`, `rounded-2xl`, `rounded-3xl`) are banned.
- Touch targets: All interactive elements (buttons, links, controls) must provide a minimum touch target size of 44x44px on touch viewports, or at least 24x24px with sufficient spacing to satisfy WCAG 2.5.8 (Target Size Minimum).
- Imagery ban: No photography, raster artwork, vector illustrations, or external images in Phase 01. Visual structure is carried by typography, spacing, borders, and restrained mauve accents.

### 7.3 Interaction, Focus, and Motion Rules

- Focus visibility: Every focusable element must display a distinct, high-contrast focus indicator when navigated via keyboard:
  - Focus utility: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]` (using `violet-300`).
  - Focus contrast: `violet-300` on `zinc-950` provides a verified 10.78:1 contrast ratio, far exceeding the 3:1 requirement.
  - Suppressing focus outlines with `outline-none` without an explicit accessible replacement is prohibited.
- Hover and active states:
  - Interactive controls provide subtle, accessible visual feedback on hover and press states without shifting layout geometry.
  - Primary button transitions use `violet-300` (default) to `violet-200` (hover) and `violet-400` (active).
- Motion rules:
  - Calibrated to MOTION_INTENSITY 2 (nearly static).
  - Subtle, functional transitions only (100ms to 150ms ease-out) for hover, active, and focus states.
  - Strictly no decorative animations, bounce physics, parallax scrolling, or ambient looping motions.
- Reduced motion:
  - CSS rules must honor `prefers-reduced-motion: reduce`.
  - Transitions and animations must be disabled or set to `duration-0` / instantaneous when reduced-motion preferences are detected.

### 7.4 Responsive Behavior

- Mobile-first responsive strategy targeting standard breakpoints:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
- Viewport bounds: Layout must adapt cleanly from 320px minimum viewport width up to ultra-wide displays.
- Zero horizontal overflow: Elements must not exceed the viewport or content container. Do not use `overflow-x: hidden` to conceal layout defects.
- Flexible flow: Navigation and header elements re-stack or collapse gracefully without overlapping content.

### 7.5 React Server Component (RSC) and Client Boundaries

- Server Components by default: Root layout, Shell, Container, Typography wrappers, StatusBadge, route Loading, and route NotFound components remain pure React Server Components.
- Client Components (`"use client"`): Restricted exclusively to components that require DOM events, browser APIs, or local state:
  - Route error boundary (`app/error.tsx`).
  - Interactive navigation toggles if dynamic client state is required.
- Boundary security invariant: Client components never receive database connections, secret keys, or sensitive backend parameters.

## 8. Minimal Primitive Inventory

Phase 01 implements a minimal, disciplined set of UI primitives designed for the Mauve Precision aesthetic. Complex interactive components and bulky third-party libraries are intentionally excluded.

### 8.1 Primitive Specifications

1. `Container`
   - Purpose: Standard layout wrapper providing max-width constraint and responsive horizontal padding.
   - Component type: React Server Component.
   - Props: `children`, `className`, `as` (semantic HTML tag, defaults to `div`).

2. `SkipLink`
   - Purpose: Direct keyboard bypass link jumping immediately to the primary content landmark.
   - Component type: React Server Component.
   - Target: `#main-content`.
   - Behavior: Visually hidden off-screen by default; becomes prominently visible at the top of the viewport when focused via keyboard navigation, styled with a high-contrast `violet-300` outline on `zinc-950`.
   - Props: `href` (defaults to `#main-content`), `children` (defaults to "Skip to main content").

3. `Button`
   - Purpose: Standard accessible button or button-styled anchor.
   - Component type: Shared presentational component that remains server-renderable. A client caller owns any event handler or local state.
   - Corner radius: 6px (`rounded-[6px]`).
   - Variants:
     - `primary`: Background `violet-300`, text `zinc-950`, hover `bg-violet-200`, active `bg-violet-400`.
     - `secondary`: Background `zinc-800`, text `zinc-100`, hover `bg-zinc-700`.
     - `outline`: Border `zinc-500`, background transparent, text `zinc-100`, hover `bg-zinc-900`.
     - `ghost`: Background transparent, text `zinc-100`, hover `bg-zinc-900`.
   - Sizes: `sm`, `md`, `lg` (all satisfying touch target requirements).
   - Behavior: Native `<button>` for actions and a separate link treatment for navigation. Native buttons use the `disabled` attribute; disabled links use `aria-disabled="true"` and cannot navigate.
   - Props: `variant`, `size`, `disabled`, `children`, `className`, plus native button attributes.

4. `StatusBadge`
   - Purpose: Inline visual status and classification tag.
   - Component type: React Server Component.
   - Corner radius: Full pill (`rounded-full`), reserved strictly for badges.
   - Variants:
     - `neutral`: Background `zinc-800`, text `zinc-300`.
     - `success`: Background `emerald-950`, text `emerald-300`.
     - `warning`: Background `amber-950`, text `amber-300`.
     - `danger`: Background `rose-950`, text `rose-300`.
     - `info`: Background `sky-950`, text `sky-300`.
   - Accessibility requirement: Strict compliance with the color-not-only rule. Every badge renders an explicit text label. A supporting icon is decorative and hidden from assistive technology when the label already communicates the state.
   - Props: `variant`, `icon`, `children`, `className`.

5. `Shell`
   - Purpose: Root application layout frame structuring standard page landmarks on the dark `zinc-950` canvas.
   - Component type: React Server Component.
   - Landmark structure:
     - Banner: `<header>` containing club identification and a future navigation slot.
     - Navigation: `<nav aria-label="Main navigation">` providing primary links.
     - Main content: `<main id="main-content" tabindex="-1">` receiving focus from `SkipLink`.
     - Footer: `<footer>` containing the minimal project and license context appropriate to this phase.
   - Props: `children`.

### 8.2 Primitive Boundaries and Library Independence

- Complex primitives such as modal dialogs, dropdown menus, context menus, comboboxes, drawers, and tabs are intentionally excluded from Phase 01.
- shadcn/ui remains unnecessary for this minimal primitive set. All components are implemented as lightweight, native React components with Tailwind utility classes referencing theme variables.
- If a future phase requires a complex interactive control, that phase must justify the primitive within its own planning document.

## 9. Route-Level Loading, Error, and Not-Found States

Phase 01 establishes accessible, cohesive route states under the App Router convention, styled consistently with the Mauve Precision aesthetic:

### 9.1 Loading State (`app/loading.tsx`)

- Component type: React Server Component.
- Behavior: Renders an accessible skeleton shell on `zinc-950` with `zinc-900` panels and `zinc-800` pulses while server components stream.
- Accessibility: Includes `aria-busy="true"` on the loading container and an accessible screen-reader announcement (`<span className="sr-only">Loading page content...</span>`).
- Layout integration: Renders cleanly inside the root Shell without causing layout shift.

### 9.2 Error State (`app/error.tsx`)

- Component type: Client component (`"use client"`).
- Behavior: React error boundary capturing uncaught render errors in child route segments.
- Styling: Renders on the dark canvas with a `zinc-900` container, `rose-300` error badge or alert text, and a Mauve Precision primary button.
- Content: User-friendly error message, sanitized against leaking stack traces, environment details, or server paths.
- Actions: Accessible "Try again" button invoking the `reset()` callback, plus a navigation link returning to the home page.
- Accessibility: Uses `role="alert"` or an `aria-live="polite"` region to announce the error to assistive technology.

### 9.3 Not-Found State (`app/not-found.tsx`)

- Component type: React Server Component.
- Behavior: Renders when `notFound()` is invoked or an unknown route is accessed.
- Content: Clear statement on the dark canvas that the requested page does not exist, accompanied by a Mauve Precision button or link to return home.
- Preserved protections: Preserves standard Shell landmarks, layout styling, and security headers (`X-Robots-Tag: noindex, nofollow, noarchive`).

## 10. WCAG 2.2 AA Requirements and Invariants

The interface foundation must satisfy WCAG 2.2 AA standards:

1. Color Contrast (WCAG 1.4.3, 1.4.11)
   - Normal text: At least 4.5:1 contrast ratio against the underlying surface. Verified ratios include `zinc-100` on `zinc-950` at 18.10:1 and `zinc-100` on `zinc-900` at 16.12:1.
   - Large text (>= 24px regular or >= 18.66px bold): At least 3:1 contrast ratio.
   - UI components and graphical objects: At least 3:1 contrast ratio against adjacent surfaces for interactive boundaries and focus indicators (`border` `zinc-500` on `zinc-900` at 3.67:1; `focus` `violet-300` on `zinc-950` at 10.78:1).
   - Status badge contrast: Status badge text on status surfaces achieves 9.94:1 (`success`), 10.39:1 (`warning`), 8.27:1 (`danger`), and 8.32:1 (`info`), all exceeding requirements.

2. Color-Not-Only Rule (WCAG 1.4.1)
   - Color must never serve as the sole mechanism for conveying information, indicating an action, prompting a response, or distinguishing a visual element.
   - Status badges, form alerts, and interactive states must combine color with explicit text labels, accessible icons, weight differences, or underline styling.
   - Status tokens are semantic exceptions, not competing brand accents.

3. Keyboard Accessibility and Focus (WCAG 2.1.1, 2.1.2, 2.4.7, 2.4.11, 2.4.13)
   - Every interactive control must be operable via standard keyboard interactions.
   - No keyboard traps.
   - Highly visible focus rings on all focused elements using `violet-300` with 10.78:1 contrast against the canvas.

4. Page Structure and Landmarks (WCAG 1.3.1)
   - Semantic HTML5 landmarks (`header`, `nav`, `main`, `footer`).
   - Logical heading sequence (`h1` through `h3`) without missing intermediate levels.

5. Skip Link (WCAG 2.4.1)
   - Accessible bypass mechanism as the first focusable element on every page, navigating directly to `#main-content`.

6. Target Size (WCAG 2.5.8)
   - Minimum target size of 24x24px, with primary interactive controls targeting 44x44px.

7. Motion and Animation (WCAG 2.3.3)
   - Motion intensity is minimal (dials calibrated to 2).
   - Motion and transition effects must honor `prefers-reduced-motion: reduce` by setting durations to zero.

## 11. Dependency Policy and shadcn/ui Decision

The repository maintains a minimal, locked dependency graph:

- Next.js `16.3.3`
- React / React DOM `19.2.8`
- Tailwind CSS `4.3.3`
- Vitest `4.1.11`, React Testing Library `16.3.3`, Playwright `1.62.1`

### Decision on shadcn/ui

- Architecture stance (`architecture.md` Section 5 and Section 14): "shadcn/ui, selectively - Use for complex accessible controls; it does not define LOGOS visual identity."
- Phase 01 evaluation: The primitives required in this phase (Container, SkipLink, Button, StatusBadge, Shell, route states) are lightweight, standard HTML elements easily authored with clean, accessible React code and Tailwind utility classes.
- Explicit decision: shadcn/ui remains unnecessary for this minimal primitive set.
- No shadcn CLI, Radix UI packages, or third-party component libraries will be installed in Phase 01.
- Introducing shadcn/ui is deferred until a later phase (such as Phase 07 or Phase 09) demonstrates a concrete requirement for a complex interactive control (such as an accessible combobox, calendar picker, or modal dialog) that justifies third-party runtime dependencies.

## 12. Automated Verification and Test Plan

Phase 01 establishes a dual-tier automated test suite covering unit, accessibility, and browser integration scenarios.

### 12.1 Vitest and React Testing Library Suite

- Primitive unit tests:
  - `Container`: Verifies rendering, custom tag support, class pass-through.
  - `SkipLink`: Verifies accessible role, default link text, target `#main-content`, and focus visibility classes with `violet-300` focus outline.
  - `Button`: Verifies button vs anchor element rendering, 6px radius (`rounded-[6px]`), Mauve Precision variant and size classes, disabled state (`aria-disabled`), keyboard trigger event handling.
  - `StatusBadge`: Verifies rendering of all five variants, pill radius (`rounded-full`), inclusion of explicit text content (color-not-only rule), and ARIA attributes.
  - `Shell`: Verifies semantic landmarks (`banner`, `navigation`, `main`, `contentinfo`), presence of skip link target, dark background styling, and children rendering.
- Route template tests:
  - `app/loading.tsx`: Verifies `aria-busy="true"` attribute and screen-reader announcement.
  - `app/error.tsx`: Verifies error message presentation, "Try again" action calling `reset()`, home navigation link, and lack of sensitive stack trace exposure.
  - `app/not-found.tsx`: Verifies 404 message, home navigation link, and landmark structure.

### 12.2 Playwright (Chromium) End-to-End Suite

The end-to-end suite runs against the production build (`next build && next start`):

1. Skip Link and Keyboard Navigation
   - Loads the root page, presses `Tab`, and asserts the skip link receives initial focus.
   - Presses `Enter` on the skip link and asserts focus shifts to `#main-content`.

2. Landmark Verification
   - Verifies the banner, labeled navigation, `<main id="main-content">`, and content information landmarks through their native roles.
   - Validates heading hierarchy starting at `h1` without skipping levels.

3. Responsive Layout and Horizontal Overflow
   - Tests viewports:
     - Mobile: 375x667 (iPhone SE), 390x844 (iPhone 12/13/14)
     - Tablet: 768x1024 (iPad)
     - Desktop: 1280x720 (Standard HD), 1440x900 (MacBook), 1920x1080 (FHD)
   - Evaluates on each viewport: `document.documentElement.scrollWidth <= window.innerWidth` (zero horizontal overflow down to 320px width).

4. Reduced Motion
   - Emulates `prefers-reduced-motion: reduce` in the browser context.
   - Asserts transitions and animations are disabled or have zero duration.

5. Accessibility and Contrast Verification
   - Evaluates color contrast across all rendered text and interactive controls against WCAG 2.2 AA thresholds and verified Mauve Precision contrast evidence.
   - Verifies no status or information is communicated through color alone.

6. Security Headers and Noindex Preservation
   - Verifies that `/` and an arbitrary invalid route preserve all baseline security response headers from `proxy.ts`. Loading and error files are special route states, not directly addressable URLs, and are verified at the component level.
     - `Content-Security-Policy`
     - `Permissions-Policy`
     - `Referrer-Policy: no-referrer`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-Robots-Tag: noindex, nofollow, noarchive`
     - `<meta name="robots" content="noindex, nofollow" />`

## 13. Work Order and Commit Checkpoints

Phase 01 implementation proceeds through structured, coherent Conventional Commits on the feature branch:

1. `feat: configure mauve precision semantic tokens and baseline typography`
   - Configures CSS custom properties referencing Tailwind palette variables for Mauve Precision, system sans typography, and dark-only base styling.
2. `feat: add core accessible ui primitives`
   - Implements lightweight Container, SkipLink, Button (6px radius), StatusBadge (pill radius), and Shell primitives conforming to Mauve Precision.
3. `feat: create application shell and route state templates`
   - Implements the dark-first root layout shell, `app/loading.tsx`, `app/error.tsx`, and `app/not-found.tsx`.
4. `test: add unit and browser accessibility tests`
   - Adds Vitest/RTL component tests and Playwright Chromium end-to-end tests covering landmarks, skip link, viewports, overflow, reduced motion, headers, and verified contrast.
5. `docs: complete phase 01 interface foundation`
   - Updates planning documentation with completion evidence, test results, and Phase 02 handoff details.

Each commit must be atomic, contain one coherent concern, pass local quality checks, and avoid introducing secrets or unapproved dependencies.

## 14. System Boundaries and Invariants

- Zero-cost boundary: All implementation runs within Vercel Hobby and GitHub Free tiers. No paid services, APIs, or infrastructure add-ons may be introduced.
- Synthetic-data boundary: Only synthetic placeholder content and neutral text may be used. Real student names, email addresses, club rosters, or legacy Google Form data are strictly prohibited.
- Dormant Production boundary: The Vercel Production deployment remains pinned to the dormant `production-disabled-until-phase-11` branch. The custom domain `tislogos.org` serves no production traffic. Merging to `main` produces only an access-protected Preview deployment.
- Theme scope boundary: Dark-first and dark-only in Phase 01. Automatic theme switching and theme toggles are prohibited; future light mode is deferred.
- Visual purity boundary: Gradients, glassmorphism, glow, excessive effects, decorative animation, generic dashboard styling, bulky component-library styling, and imagery are strictly prohibited.
- Phase 02+ boundaries:
  - No database tables, migrations, or Drizzle ORM configuration (Phase 02).
  - No security journal, rate limiter, or audit outbox (Phase 03).
  - No Neon Auth, Google OAuth, or user authorization logic (Phase 04).
  - No Google Workspace adapters or API tokens (Phase 05).
  - No public content authoring, leadership profiles, or announcements (Phase 06).
  - No membership, attendance, absence, or warning workflows (Phases 07-09).
  - No backup, archive, or disaster recovery tooling (Phase 10).
  - No public domain cutover or live launch (Phase 11).

## 15. Completion Gate

Phase 01 is complete only when all of the following criteria are verified with reviewable evidence:

1. Approved design direction: Mauve Precision is the recorded, approved design direction; implementation conforms strictly to its zinc neutral family, mauve (Tailwind violet) accent mappings, 6px component radius, pill badges, and dark-only scope.
2. Semantic tokens implemented: Semantic color tokens are defined via CSS custom properties referencing official Tailwind CSS palette variables (`zinc-950`, `zinc-100`, `zinc-900`, `zinc-800`, `violet-300`, `violet-200`, `violet-400`, `zinc-500`, `zinc-400`, `emerald-300`, `emerald-950`, `amber-300`, `amber-950`, `rose-300`, `rose-950`, `sky-300`, `sky-950`) without arbitrary hex duplicates.
3. Primitives delivered: Lightweight `Container`, `SkipLink`, `Button` (6px radius), `StatusBadge` (pill radius), and `Shell` are implemented, documented, and exported.
4. Route states delivered: Accessible dark-first `app/loading.tsx`, `app/error.tsx`, and `app/not-found.tsx` states are implemented and integrated into the application shell.
5. Keyboard navigation and focus: Full keyboard navigability is verified; focus rings use `violet-300` with high visibility and verified 10.78:1 contrast against the `zinc-950` canvas.
6. Skip link verified: The skip link is the first focusable element and jumps keyboard focus directly to `#main-content`.
7. Color-not-only rule and status governance: All status badges and alerts pair color with explicit text labels. Status tokens act strictly as functional exceptions, not competing brand accents.
8. WCAG 2.2 AA contrast verified: Normal text achieves at least 4.5:1 contrast; large text and UI boundaries achieve at least 3:1 contrast; all verified contrast figures (including foreground/background 18.10:1 and foreground/surface 16.12:1) are confirmed in automated checks.
9. Responsive and overflow verified: Layout renders cleanly across mobile (375px, 390px), tablet (768px), and desktop (1280px, 1440px, 1920px) viewports with zero horizontal overflow down to 320px width.
10. Reduced motion verified: Animations and transitions are disabled or instantaneous under `prefers-reduced-motion: reduce`.
11. Dependency policy respected: shadcn/ui remains unnecessary for this primitive set, and no unapproved third-party component libraries are installed.
12. Security protections preserved: All baseline security headers in `proxy.ts` and `noindex, nofollow, noarchive` robots directives are active on all routes and error states.
13. Automated tests pass: Vitest/RTL unit tests and Playwright Chromium end-to-end tests pass cleanly.
14. Aggregate verification passes: `pnpm check` executes formatting, linting, type-checking, unit tests, build, and end-to-end tests without errors.
15. Clean repository: No secrets, credentials, environment files, or real student data exist in the branch.
16. Commit checkpoints recorded: Implementation consists of coherent Conventional Commits on the feature branch.

## 16. Handoff to Phase 02

Upon satisfying the completion gate, Phase 01 hands off:

- A stable, responsive application shell and Mauve Precision semantic token system.
- Reusable accessible UI primitives ready for data-driven views.
- Standard route loading, error, and not-found templates.
- An expanded test suite covering component accessibility and browser layout behavior.
- Documented design tokens ready to style future forms and data tables.

Phase 02 (Data and environment foundation) builds upon this foundation to introduce Neon PostgreSQL in Singapore, Drizzle ORM, version-controlled migrations, least-privilege database roles, and synthetic fixtures without needing to revise or refactor the user interface architecture.
