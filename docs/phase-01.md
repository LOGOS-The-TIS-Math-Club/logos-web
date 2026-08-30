# Phase 01 - Interface and Design-System Foundation

> - Status: Completed
> - Roadmap: [roadmap.md](./roadmap.md)
> - Architecture: [architecture.md](./architecture.md)
> - Predecessor: [phase-00.md](./phase-00.md)
> - Successor: phase-02.md
> - First release target: `0.1.0`
> - Unreleased manifest version: `0.0.0`
> - Last updated: 2026-08-30

## 1. Objective

Establish a responsive, accessible application shell and reusable interface foundation for LOGOS Web following the approved Mauve Precision design direction. The phase defines a dark-first, dark-only semantic design token system backed exclusively by the official Tailwind CSS color palette, introduces lightweight and meticulously polished accessible UI primitives, establishes route-level loading, error, and not-found states, and proves responsive and keyboard navigation behaviors across target viewports without introducing database, authentication, or external provider dependencies. Future light mode is explicitly deferred.

## 2. Design Gate Status and Implementation State

The design gate for Phase 01 is approved. The user has reviewed provisional proposals, explicitly rejected previous alternatives, and approved the Mauve Precision direction.

Phase 01 status is **Completed**. The implementation was delivered via protected [pull request #6](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/pull/6) and squash-merged into `main` on 2026-08-30 as commit [`000aa25c229c559ea6b20e69cd5e15ada147e6dd`](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/commit/000aa25c229c559ea6b20e69cd5e15ada147e6dd) with title `feat: establish interface foundation`. All pull-request checks (`Quality`, `Browser smoke`, `Supply chain`, `Vercel`), post-merge workflows, and protected Vercel Preview deployment checks passed. Clean synchronized `main` passes all local verification gates. Handoff to Phase 02 is available, but Phase 02 planning and implementation have not started.

Implementation of visual styles, Tailwind tokens, component primitives, and shell layouts adheres strictly to the approved Mauve Precision specifications defined in this document.

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
- Lightweight, meticulously polished UI primitive inventory: Container, SkipLink, Button, StatusBadge, and AppShell layout.
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
- Vitest and React Testing Library component test suite (39 tests across 9 files).
- Playwright Chromium end-to-end test suite (8 tests) verifying landmarks, skip link, responsive viewports (320px to 1440px), zero horizontal overflow, reduced motion, security headers, 404 title/navigation, and AxeBuilder automated WCAG scans with zero violations.
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
| `secondary-hover`      | `zinc-700` (`var(--color-zinc-700)`)       | Hover feedback state for secondary interactive elements                |
| `secondary-active`     | `zinc-600` (`var(--color-zinc-600)`)       | Pressed/active feedback state for secondary interactive elements       |
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
  - Default layout container: `max-w-7xl` (1280px).
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
  - Primary button transitions use `violet-300` (default) to `violet-200` (`primary-hover`) and `violet-400` (`primary-active`).
  - Secondary button transitions use `zinc-800` (default) to `zinc-700` (`secondary-hover`) and `zinc-600` (`secondary-active`).
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

- Server Components by default: Root layout, AppShell, Container, StatusBadge, route Loading, and route NotFound components remain pure React Server Components.
- Client Components (`"use client"`): Restricted exclusively to components that require DOM events, browser APIs, or local state:
  - Route error boundary (`app/error.tsx`).
  - Interactive navigation toggles if dynamic client state is required.
- Boundary security invariant: Client components never receive database connections, secret keys, or sensitive backend parameters.

## 8. Minimal Primitive Inventory

Phase 01 implements a minimal, disciplined set of UI primitives designed for the Mauve Precision aesthetic. Complex interactive components and bulky third-party libraries are intentionally excluded.

### 8.1 Primitive Specifications

1. `Container`
   - Purpose: Standard layout wrapper providing max-width constraint (`max-w-7xl`) and responsive horizontal padding (`px-4 sm:px-6 lg:px-8`).
   - Component type: React Server Component.
   - Implementation: Intentional lightweight `div` wrapper with `children`, `className`, and native `div` attributes (`HTMLAttributes<HTMLDivElement>`); no polymorphic `as` prop.
   - Props: `children`, `className`, plus native HTML `div` attributes.

2. `SkipLink`
   - Purpose: Direct keyboard bypass link jumping immediately to the primary content landmark.
   - Component type: React Server Component.
   - Target: `#main-content`.
   - Behavior: Visually hidden off-screen by default; becomes prominently visible at the top of the viewport when focused via keyboard navigation, styled with a high-contrast `violet-300` outline on `zinc-950`.
   - Props: `href` (defaults to `#main-content`), `children` (defaults to "Skip to main content"), `className`, plus native anchor attributes (`AnchorHTMLAttributes<HTMLAnchorElement>`).

3. `Button`
   - Purpose: Standard accessible button for user actions.
   - Component type: Shared presentational component renderable by server and client callers.
   - Corner radius: 6px (`rounded-[6px]`).
   - Variants:
     - `primary`: Background `violet-300`, text `zinc-950`, hover `bg-primary-hover` (`violet-200`), active `bg-primary-active` (`violet-400`).
     - `secondary`: Background `zinc-800`, text `zinc-100`, hover `bg-secondary-hover` (`zinc-700`), active `bg-secondary-active` (`zinc-600`).
     - `outline`: Border `zinc-500`, background transparent, text `zinc-100`, hover `bg-surface`, active `bg-surface-raised`.
     - `ghost`: Background transparent, text `zinc-100`, hover `bg-surface`, active `bg-surface-raised`.
   - Sizes: `sm` (`min-h-11 px-3 py-2 text-xs`), `md` (`min-h-11 px-4 py-2.5 text-sm`), `lg` (`min-h-11 px-6 py-3 text-base`) (all satisfying touch target requirements with `min-h-11`).
   - Behavior: Native `<button>` only for user actions. Navigation uses directly styled Next.js `Link` elements; there is no anchor or disabled-link API on `Button`. Disabled state uses the native `disabled` attribute (`disabled:cursor-not-allowed disabled:opacity-50`).
   - Props: `type` (defaults to `"button"`), `variant`, `size`, `disabled`, `children`, `className`, plus native button attributes (`ButtonHTMLAttributes<HTMLButtonElement>`).

4. `StatusBadge`
   - Purpose: Inline visual status and classification tag.
   - Component type: React Server Component.
   - Corner radius: Full pill (`rounded-full`), reserved strictly for badges.
   - Variants:
     - `neutral`: Background `muted` (`zinc-800`), text `muted-foreground` (`zinc-400`).
     - `success`: Background `success-surface` (`emerald-950`), text `success` (`emerald-300`).
     - `warning`: Background `warning-surface` (`amber-950`), text `warning` (`amber-300`).
     - `danger`: Background `danger-surface` (`rose-950`), text `danger` (`rose-300`).
     - `info`: Background `info-surface` (`sky-950`), text `info` (`sky-300`).
   - Accessibility requirement: Strict compliance with the color-not-only rule. Requires explicit string `children` (`children: string`) so color is never the only indicator of status. No `icon` prop in Phase 01.
   - Props: `variant`, `children: string` (required explicit string), `className`, plus native span attributes (`HTMLAttributes<HTMLSpanElement>`).

5. `AppShell`
   - Purpose: Root application layout frame structuring standard page landmarks on the dark `zinc-950` canvas.
   - Component type: React Server Component.
   - Component name: `AppShell` (exported from `components/layout/app-shell.tsx`).
   - Landmark structure:
     - Banner: `<header>` containing LOGOS brand link.
     - Navigation: `<nav aria-label="Main navigation">` providing primary links using directly styled Next.js `Link` elements.
     - Main content: `<main id="main-content" tabIndex={-1}>` receiving focus from `SkipLink`.
     - Footer: `<footer>` containing the minimal project ("The Tokyo International School Math Club") and license ("MIT License") context.
   - Props: `children`, `className`.

### 8.2 Primitive Boundaries and Library Independence

- Complex primitives such as modal dialogs, dropdown menus, context menus, comboboxes, drawers, and tabs are intentionally excluded from Phase 01.
- shadcn/ui remains unnecessary for this minimal primitive set. All components are implemented as lightweight, native React components with Tailwind utility classes referencing theme variables.
- If a future phase requires a complex interactive control, that phase must justify the primitive within its own planning document.

## 9. Route-Level Loading, Error, and Not-Found States

Phase 01 establishes accessible, cohesive route states under the App Router convention, styled consistently with the Mauve Precision aesthetic:

### 9.1 Loading State (`app/loading.tsx`)

- Component type: React Server Component.
- Behavior: Renders an accessible skeleton shell on `zinc-950` with `zinc-900` panels and `zinc-800` pulses while server components stream.
- Accessibility: Includes `role="status"`, `aria-live="polite"`, and `aria-busy="true"` on the loading container, presenting visible "Loading content..." announcement text (not a separate `sr-only` span).
- Layout integration: Renders cleanly inside the root AppShell without causing layout shift.

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
- Metadata: Defines a distinct page `Metadata` title (`title: "Page Not Found | LOGOS Web"`).
- Content: Clear statement on the dark canvas that the requested page does not exist, accompanied by a Mauve Precision styled Next.js `Link` returning home.
- Preserved protections: Preserves standard AppShell landmarks, layout styling, and security headers (`X-Robots-Tag: noindex, nofollow, noarchive`).

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

### 11.1 Decision on shadcn/ui

- Architecture stance (`architecture.md` Section 5 and Section 14): "shadcn/ui, selectively - Use for complex accessible controls; it does not define LOGOS visual identity."
- Phase 01 evaluation: The primitives required in this phase (Container, SkipLink, Button, StatusBadge, AppShell, route states) are lightweight, standard HTML elements easily authored with clean, accessible React code and Tailwind utility classes.
- Explicit decision: shadcn/ui remains unnecessary for this minimal primitive set.
- No shadcn CLI, Radix UI packages, or third-party component libraries will be installed in Phase 01.
- Introducing shadcn/ui is deferred until a later phase (such as Phase 07 or Phase 09) demonstrates a concrete requirement for a complex interactive control (such as an accessible combobox, calendar picker, or modal dialog) that justifies third-party runtime dependencies.

## 12. Automated Verification and Test Plan

Phase 01 establishes a dual-tier automated test suite covering unit, accessibility, and browser integration scenarios.

### 12.1 Vitest and React Testing Library Suite

The unit and component test suite consists of 39 Vitest tests across 9 files:

- Primitives (`components/`):
  - `components/layout/container.test.tsx` (3 tests): Verifies rendering children accessibly, applying custom className alongside layout styling, and passing through native HTML div attributes without a polymorphic `as` prop.
  - `components/layout/skip-link.test.tsx` (4 tests): Verifies default text and `#main-content` target href, custom target href and children, focus-visible keyboard bypass styling (`violet-300` focus outline), and attribute/className pass-through.
  - `components/ui/button.test.tsx` (6 tests): Verifies default button type (`button`), variant (`primary`), and size (`md`); onClick handler invocation when clicked; native `disabled` attribute and styling when disabled; all variant classes (`primary`, `secondary`, `outline`, `ghost`); all size classes (`sm`, `md`, `lg`) satisfying 44px minimum touch targets; and submit type / custom attribute support.
  - `components/ui/status-badge.test.tsx` (8 tests): Verifies default neutral variant and pill radius (`rounded-full`); rendering all 5 variants (`neutral`, `success`, `warning`, `danger`, `info`) with expected semantic color token classes; compliance with the color-not-only rule by requiring explicit string children; and attribute/className pass-through.
  - `components/layout/app-shell.test.tsx` (6 tests): Verifies core semantic landmarks (`banner`, `navigation`, `main`, `contentinfo`); main content structure with `#main-content` and `tabindex="-1"`; skip link targeting `#main-content`; directly styled Next.js navigation links to home; 44px touch target sizing conventions on header links; footer organization and MIT license context; and custom className pass-through on the main landmark.
- Route templates and pages (`app/`):
  - `app/loading.test.tsx` (2 tests): Verifies accessible status container with `role="status"`, `aria-live="polite"`, and `aria-busy="true"`; presents visible "Loading content..." announcement text.
  - `app/error.test.tsx` (4 tests): Verifies alert role, error heading, and status badge; sanitization withholding stack traces and raw error messages; reset callback invocation on "Try again" button click; and accessible home navigation link.
  - `app/not-found.test.tsx` (3 tests): Verifies distinct page metadata title (`Page Not Found | LOGOS Web`); 404 heading and descriptive message; and accessible return home link.
  - `app/page.test.tsx` (2 tests): Verifies neutral LOGOS foundation identification and foundation principles section with correct heading hierarchy.

### 12.2 Playwright (Chromium) End-to-End Suite

The end-to-end suite in `e2e/smoke.spec.ts` executes 8 Chromium tests against the production build (`next build && next start`):

1. **Neutral application and security protections**: Loads the root page (`/`), asserts status 200, checks heading `h1` "LOGOS Web", confirms robots meta tag (`noindex, nofollow`), verifies zero browser console or page errors, and validates response security headers (`Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow, noarchive`).
2. **Dynamic health endpoint**: Calls `/health`, asserts status 200, verifies JSON body `{ status: "ok" }`, validates `Cache-Control: no-store`, and confirms baseline security headers.
3. **Semantic landmarks and heading hierarchy**: Verifies `banner`, `navigation` ("Main navigation"), `main` (`#main-content`), and `contentinfo` landmarks, along with a strict heading sequence (`h1` "LOGOS Web", `h2` "Foundation Principles", and `h3` principle subsections).
4. **Skip link and keyboard navigation**: Simulates initial `Tab` keypress to assert the skip link is focused and visible; simulates `Enter` keypress to confirm focus shifts directly to `#main-content`.
5. **404 route handling, title, and navigation**: Navigates to an unmapped route (`/non-existent-route`), confirms status 404, verifies distinct title "Page Not Found | LOGOS Web", validates baseline security headers, asserts 404 heading and descriptive text, clicks "Return home", and verifies navigation back to `/`.
6. **Responsive layout and horizontal overflow**: Iterates across 5 target viewport widths (320px, 390px, 768px, 1280px, 1440px) and asserts zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`) down to 320px width.
7. **Reduced motion compliance**: Emulates `prefers-reduced-motion: reduce`, asserts media query matches, and evaluates computed transition durations to confirm instantaneous `0s` transitions.
8. **Automated WCAG accessibility scan**: Executes `AxeBuilder` from `@axe-core/playwright` 4.13.0 across rulesets (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on both the home page (`/`) and the 404 page (`/non-existent-route`), confirming zero critical, serious, or minor accessibility violations.

## 13. Work Order and Commit Checkpoints

Phase 01 implementation proceeded through structured, coherent Conventional Commits on the feature branch:

1. `c92bb74`: `docs: plan phase 01 interface foundation`
   - Establishes the initial Phase 01 specification, token inventory, and architectural references.
2. `dc6187c`: `docs: revise phase 01 visual direction`
   - Records the user-approved Mauve Precision visual direction, design dials, and rejected alternatives.
3. `a834099`: `feat: establish semantic design tokens`
   - Configures CSS custom properties referencing Tailwind palette variables for Mauve Precision, system sans typography, and dark-only base styling in `app/globals.css`.
4. `8d8bc14`: `feat: add accessible interface primitives`
   - Implements lightweight `Container` (div wrapper), `SkipLink`, `Button` (native button, 6px radius), and `StatusBadge` (pill radius, required string children).
5. `0e38e7a`: `feat: build responsive application shell`
   - Implements the `AppShell` component structuring semantic landmarks (`header`, `nav`, `main`, `footer`) on the dark `zinc-950` canvas.
6. `a69f19a`: `feat: add route feedback states`
   - Implements dark-first `app/loading.tsx` (visible loading text), `app/error.tsx`, and `app/not-found.tsx` with distinct metadata title.
7. `225f4a9`: `test: cover interface foundation`
   - Adds 39 Vitest unit/component tests across 9 files and 8 Playwright Chromium end-to-end tests including AxeBuilder accessibility scans.
8. `e81f260`: `fix: polish foundation interactions`
   - Polishes touch target sizes, mobile-to-desktop spacing, focus outlines, and layout density.
9. `7c4b651`: `docs: document phase 01 verification`
   - Aligns repository guidance and the phase record with the implemented APIs and passing local evidence before protected review.

Each development commit was atomic and coherent, passed local quality checks, and avoided introducing unapproved dependencies or secrets. All feature branch commits were subsequently squash-merged into protected `main` as [`000aa25c229c559ea6b20e69cd5e15ada147e6dd`](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/commit/000aa25c229c559ea6b20e69cd5e15ada147e6dd) with title `feat: establish interface foundation`.

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

### 15.1 Completion Gate Criteria

Phase 01 is complete only when all of the following criteria are verified with reviewable evidence:

1. Approved design direction: Mauve Precision is the recorded, approved design direction; implementation conforms strictly to its zinc neutral family, mauve (Tailwind violet) accent mappings, 6px component radius, pill badges, and dark-only scope.
2. Semantic tokens implemented: Semantic color tokens are defined via CSS custom properties referencing official Tailwind CSS palette variables (`zinc-950`, `zinc-100`, `zinc-900`, `zinc-800`, `zinc-700`, `zinc-600`, `violet-300`, `violet-200`, `violet-400`, `zinc-500`, `zinc-400`, `emerald-300`, `emerald-950`, `amber-300`, `amber-950`, `rose-300`, `rose-950`, `sky-300`, `sky-950`) without arbitrary hex duplicates.
3. Primitives delivered: Lightweight `Container` (div wrapper without polymorphic `as`), `SkipLink`, `Button` (native button only, 6px radius), `StatusBadge` (pill radius, required string children), and `AppShell` are implemented, documented, and exported.
4. Route states delivered: Accessible dark-first `app/loading.tsx` (with visible "Loading content..." text), `app/error.tsx`, and `app/not-found.tsx` (with distinct metadata title) are implemented and integrated into the application shell.
5. Keyboard navigation and focus: Full keyboard navigability is verified; focus rings use `violet-300` with high visibility and verified 10.78:1 contrast against the `zinc-950` canvas.
6. Skip link verified: The skip link is the first focusable element and jumps keyboard focus directly to `#main-content`.
7. Color-not-only rule and status governance: All status badges and alerts pair color with explicit text labels. Status tokens act strictly as functional exceptions, not competing brand accents.
8. WCAG 2.2 AA contrast verified: Normal text achieves at least 4.5:1 contrast; large text and UI boundaries achieve at least 3:1 contrast; all verified contrast figures (including foreground/background 18.10:1 and foreground/surface 16.12:1) are confirmed in automated checks.
9. Responsive and overflow verified: Layout renders cleanly across mobile (320px, 390px), tablet (768px), and desktop (1280px, 1440px) viewports with zero horizontal overflow down to 320px width.
10. Reduced motion verified: Animations and transitions are disabled or instantaneous under `prefers-reduced-motion: reduce`.
11. Dependency policy respected: shadcn/ui remains unnecessary for this primitive set, and no unapproved third-party component libraries are installed.
12. Security protections preserved: All baseline security headers in `proxy.ts` and `noindex, nofollow, noarchive` robots directives are active on all routes and error states.
13. Automated tests pass: 39 Vitest unit/component tests across 9 files and 8 Playwright Chromium end-to-end tests (including AxeBuilder automated WCAG scans with zero violations) pass cleanly.
14. Aggregate verification passes: `pnpm check` executes formatting, linting, type-checking, unit tests, build, and end-to-end tests without errors.
15. Clean repository: No secrets, credentials, environment files, or real student data exist in the branch.
16. Commit checkpoints recorded: Implementation consists of coherent Conventional Commits on the feature branch.

### 15.2 Verification Evidence and Closeout Status

| Verification Dimension  | Command / Harness         | Status / Result                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code Formatting         | `pnpm format:check`       | **Passed**: Clean, zero formatting diffs across repository                                                                                                                                                                                                                                                                                                                                              |
| Linting                 | `pnpm lint`               | **Passed**: Clean, zero ESLint warnings or errors                                                                                                                                                                                                                                                                                                                                                       |
| Type Checking           | `pnpm typecheck`          | **Passed**: Clean, strict TypeScript (`tsc --noEmit`) passes with zero errors                                                                                                                                                                                                                                                                                                                           |
| Component Unit Tests    | `pnpm test`               | **Passed**: 39/39 Vitest tests pass across 9 test files                                                                                                                                                                                                                                                                                                                                                 |
| Production Build        | `pnpm build`              | **Passed**: Next.js production build succeeds with optimized outputs                                                                                                                                                                                                                                                                                                                                    |
| Browser E2E Suite       | `pnpm test:e2e`           | **Passed**: 8/8 Playwright Chromium tests pass against production build across viewports (320, 390, 768, 1280, 1440)                                                                                                                                                                                                                                                                                    |
| Accessibility Scans     | `AxeBuilder`              | **Passed**: Zero violations on `/` and 404 (`/non-existent-route`) via `@axe-core/playwright` 4.13.0                                                                                                                                                                                                                                                                                                    |
| Pull Request Acceptance | GitHub PR #6              | **Passed**: Protected [PR #6](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/pull/6) was accepted and squash-merged; all PR checks (`Quality`, `Browser smoke`, `Supply chain`, `Vercel`) passed                                                                                                                                                                                                  |
| Protected CI Pipeline   | GitHub Actions            | **Passed**: All PR checks and post-merge `main` workflows passed: CI ([run 33313795221](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/actions/runs/33313795221)), Security ([run 33313795206](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/actions/runs/33313795206)), Release Please ([run 33313795204](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/actions/runs/33313795204)) |
| Vercel Preview          | Vercel Hobby sin1         | **Passed**: `main` Preview succeeded at protected URL `https://logos-i2xjntd61-logos-tis.vercel.app`; unauthenticated HEAD returned HTTP 302 to Vercel SSO, `Cache-Control: no-store`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`                                                                                                                                                                 |
| Merge to `main`         | Squash merge              | **Passed**: Squash-merged 2026-08-30 as [`000aa25c229c559ea6b20e69cd5e15ada147e6dd`](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/commit/000aa25c229c559ea6b20e69cd5e15ada147e6dd) with title `feat: establish interface foundation`                                                                                                                                                            |
| Clean Synchronized Main | Synchronized `main` check | **Passed**: Local `main` is synchronized at `000aa25` and clean; verified with `pnpm check`, `release:verify`, and `pnpm audit --audit-level high`                                                                                                                                                                                                                                                      |

## 16. Handoff to Phase 02

Phase 01 is completed and its handoff is available. Phase 02 planning and implementation have not started.

With Phase 01 complete and squash-merged to `main`, the verified foundation provides:

- A stable, responsive application shell (`AppShell`) and Mauve Precision semantic token system.
- Reusable accessible UI primitives (`Container`, `SkipLink`, `Button`, `StatusBadge`) ready for data-driven views.
- Standard route loading, error, and not-found templates.
- An expanded test suite covering component accessibility (39 Vitest tests across 9 files) and browser layout behavior (8 Playwright Chromium tests with zero Axe violations).
- Documented design tokens ready to style future forms and data tables.

Phase 02 (Data and environment foundation) will build upon this foundation to introduce Neon PostgreSQL in Singapore, Drizzle ORM, version-controlled migrations, least-privilege database roles, and synthetic fixtures without needing to revise or refactor the user interface architecture.

## 17. Completion Record

Phase 01 completed on 2026-08-30 through the protected squash merge of [pull request #6](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/pull/6) as commit [`000aa25c229c559ea6b20e69cd5e15ada147e6dd`](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/commit/000aa25c229c559ea6b20e69cd5e15ada147e6dd) (`feat: establish interface foundation`).

- **Version:** The private manifest remains `0.0.0`. Deterministic Release Please verification confirmed `0.1.0` remains the first release proposal; no release or tag was created merely to close this phase.
- **Commits and merge:** Development proceeded through 9 coherent Conventional Commits on the feature branch (`c92bb74` through `7c4b651`), which were subsequently squash-merged into protected `main` as commit `000aa25`.
- **Local and remote verification:** Local clean synchronized `main` at `000aa25` passes `pnpm check`, `release:verify`, and `pnpm audit --audit-level high`. The test suites pass completely: 39 Vitest tests across 9 files and 8 Playwright Chromium tests verifying landmarks, skip link, responsive viewports (320px to 1440px) with zero horizontal overflow, reduced motion, security headers, and automated AxeBuilder scans with zero WCAG violations. All pull request #6 checks passed (`Quality`, `Browser smoke`, `Supply chain`, `Vercel`). Post-merge `main` runs all passed: CI ([run 33313795221](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/actions/runs/33313795221)), Security ([run 33313795206](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/actions/runs/33313795206)), and Release Please ([run 33313795204](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/actions/runs/33313795204)).
- **Delivery and Preview evidence:** The `main` Vercel Preview deployment succeeded at protected URL `https://logos-i2xjntd61-logos-tis.vercel.app`. An unauthenticated HEAD request returned HTTP `302` redirect to Vercel SSO authentication, with headers `Cache-Control: no-store`, `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex`. Vercel Production remains attached to the dormant `production-disabled-until-phase-11` branch, and the retained domain `tislogos.org` serves no public traffic.
- **Dependencies and shadcn/ui:** The locked dependency graph is preserved without adding new runtime packages. shadcn/ui remains unnecessary for this minimal primitive set (`Container`, `SkipLink`, `Button`, `StatusBadge`, `AppShell`); all components are native, lightweight React components consuming semantic tokens.
- **Preserved boundaries:** All implementation operates strictly on synthetic data and neutral placeholders with no real student data, database, authentication, Google Workspace, or external APIs introduced. Dark-only scope is preserved; future light mode remains deferred. Baseline security headers in `proxy.ts` and `noindex, nofollow, noarchive` search directives remain active.
- **Approved deviations:** None.

Phase 02 may begin from this verified foundation once an execution plan is approved; Phase 02 planning and implementation have not started.
