# Phase 01 - Interface and Design-System Foundation

> - Status: Planned
> - Roadmap: [roadmap.md](./roadmap.md)
> - Architecture: [architecture.md](./architecture.md)
> - Predecessor: [phase-00.md](./phase-00.md)
> - Successor: phase-02.md
> - First release target: `0.1.0`
> - Unreleased manifest version: `0.0.0`
> - Last updated: 2026-08-30

## 1. Objective

Establish a responsive, accessible application shell and reusable interface foundation for LOGOS Web. The phase defines a semantic design token system backed exclusively by the official Tailwind CSS color palette, introduces minimal accessible UI primitives, establishes route-level loading, error, and not-found states, and proves responsive and keyboard navigation behaviors across target viewports without introducing database, authentication, or external provider dependencies.

## 2. Explicit Design Approval Gate

Visual direction, token mapping, neutral family, accent color, typography pairings, and corner radii remain explicitly undecided. No design direction is approved yet.

Implementation of visual styles, Tailwind token classes, or styled components cannot proceed until the user explicitly selects or approves a direction. The three candidate directions documented in Section 5 are strictly provisional proposals submitted for user evaluation.

Neither this document nor the repository claims user approval or implementation evidence for any visual direction. Once user approval is recorded, the selected direction will govern the semantic token values and component styling for this and subsequent phases.

## 3. Architecture References and Authority

This plan is governed by the project planning hierarchy:

1. `architecture.md` defines system-wide invariants, technology choices, and provider boundaries.
2. `roadmap.md` defines phase sequencing, dependencies, and broad completion gates.
3. `phase-01.md` defines the execution plan, candidate directions, token inventory, and acceptance gates for Phase 01.

Specific architectural anchors from `architecture.md` governing this phase include:

- Section 2 (Architectural drivers): Security and privacy, simplicity (club scale of approximately 20 members), maintainability, low-cost operation, and accessibility targeting WCAG 2.2 AA across devices and input methods.
- Section 5 (Technology baseline): Next.js App Router, React Server Components by default, strict TypeScript, Node.js 24 LTS, pnpm, Tailwind CSS as the styling foundation, selective shadcn/ui primitives, Vitest, React Testing Library, and Playwright.
- Section 14 (Frontend and design foundation): The official Tailwind CSS color palette is the mandatory raw color vocabulary. Semantic tokens (`background`, `foreground`, `surface`, `primary`, `secondary`, `muted`, `border`, `focus`, `success`, `warning`, `danger`, `info`) must map to official Tailwind palette values. Color never serves as the only indicator of status. Every token pair must meet WCAG 2.2 AA contrast. Visible keyboard focus, accessible names, and responsive behavior are required from the start.
- Section 15 (Next.js implementation conventions): App Router is mandatory. React Server Components are the default; client components are introduced only for browser interaction or client state.
- Section 17 (Deployment, environments, and regions): Singapore dynamic function region (`sin1`), access-protected Vercel Preview deployments, and dormant Production branch (`production-disabled-until-phase-11`).
- Section 18 (Testing and release gates): Accessible UI behavior, risk-based coverage, Playwright smoke suite, and CI quality gates.
- Section 20 (Cost, scale, and portability): Free-tier alignment (Vercel Hobby, GitHub Free) and zero-cost operation.
- Section 22 (Explicitly deferred decisions): Exact LOGOS Tailwind colors, semantic token values, typography, imagery, and dark-theme decision.

## 4. Scope and Non-Goals

### 4.1 In-Scope Deliverables

- Explicit design approval gate establishing candidate directions as provisional until user selection.
- Semantic token architecture defining CSS custom properties mapped to official Tailwind CSS palette steps.
- Three concise candidate design directions with defined neutral, accent, typography, theme support, corner radii, and design dials.
- Minimal provisional UI primitive inventory: Container, Skip Link, Button, Status Badge, and Shell layout.
- Route-level status templates: `app/loading.tsx`, `app/error.tsx`, and `app/not-found.tsx`.
- Typography baseline using system font stacks without external network fetches.
- Spacing, sizing, and touch target conventions based on a 4px baseline grid.
- Keyboard navigation, visible focus indicators, and reduced-motion support.
- WCAG 2.2 AA accessibility requirements and the color-not-only rule.
- Dependency evaluation recording that shadcn/ui is pending and currently unnecessary for Phase 01.
- Vitest and React Testing Library component test suite.
- Playwright Chromium end-to-end test suite verifying landmarks, skip link, viewports, zero horizontal overflow, reduced motion, security headers, and contrast.
- Preservation of baseline security headers in `proxy.ts` and `noindex, nofollow, noarchive` search directives.

### 4.2 Non-Goals

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

## 5. Candidate Design Directions (Provisional)

Three provisional candidate directions are defined for user evaluation. Each candidate conforms to the mandatory Tailwind CSS color palette and WCAG 2.2 AA contrast requirements.

The design dials use the project design vocabulary on a 1 to 10 scale:

- `DESIGN_VARIANCE`: 1 is highly symmetrical and 10 is highly asymmetric.
- `MOTION_INTENSITY`: 1 is effectively static and 10 is cinematic.
- `VISUAL_DENSITY`: 1 is very spacious and 10 is highly compact.

### Direction 1: Euclidean Institute (Recommended)

- Neutral family: Slate (`slate-50` through `slate-950`)
- Accent color: Blue (`blue-600` in light mode, `blue-500` in dark mode)
- Typography: System sans font stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
- Theme support: Dual light and dark mode
- Corner radii: Disciplined 4px radii (`rounded`, `0.25rem`)
- Design dials: `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 5`
- Recommendation status: Recommended baseline proposal
- Aesthetic character: Academic rigor, mathematical structure, cartesian framing, crisp hairline borders, and calm institutional precision suited for an international school mathematics society.

### Direction 2: Modern Precision

- Neutral family: Zinc (`zinc-50` through `zinc-950`)
- Accent color: Teal (`teal-600` in light mode, `teal-500` in dark mode)
- Typography: System sans font stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
- Theme support: Dual light and dark mode
- Corner radii: Soft 8px radii (`rounded-lg`, `0.5rem`)
- Design dials: `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 4`
- Recommendation status: Alternative provisional option
- Aesthetic character: Compact technical product aesthetic, balanced softness, high-utility dashboard feel, modern software engineering presentation.

### Direction 3: Scholastic Monograph

- Neutral family: Stone (`stone-50` through `stone-950`)
- Accent color: Indigo (`indigo-700` in light mode)
- Typography: System serif headings (`ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`) paired with system sans controls and tabular data (`ui-sans-serif, system-ui, sans-serif`)
- Theme support: Light-only (warm archival monograph aesthetic)
- Corner radii: Balanced 6px radii (`rounded-md`, `0.375rem`)
- Design dials: `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 4`
- Recommendation status: Alternative provisional option
- Aesthetic character: Bookish editorial hierarchy, traditional mathematical publication, warm paper texture feel, archival distinction.

### Candidate Direction Comparison

| Dimension          | Direction 1: Euclidean Institute (Recommended) | Direction 2: Modern Precision    | Direction 3: Scholastic Monograph |
| ------------------ | ---------------------------------------------- | -------------------------------- | --------------------------------- |
| Neutral family     | Slate                                          | Zinc                             | Stone                             |
| Accent family      | Blue                                           | Teal                             | Indigo                            |
| Heading font       | System sans                                    | System sans                      | System serif                      |
| Body/UI font       | System sans                                    | System sans                      | System sans                       |
| Theme support      | Dual light and dark                            | Dual light and dark              | Light-only                        |
| Corner radii       | Disciplined 4px (`rounded`)                    | Soft 8px (`rounded-lg`)          | Balanced 6px (`rounded-md`)       |
| `DESIGN_VARIANCE`  | 4 / 10                                         | 5 / 10                           | 5 / 10                            |
| `MOTION_INTENSITY` | 2 / 10                                         | 3 / 10                           | 2 / 10                            |
| `VISUAL_DENSITY`   | 5 / 10                                         | 4 / 10                           | 4 / 10                            |
| Visual tone        | Crisp, academic, cartesian                     | Technical, compact, contemporary | Editorial, archival, monograph    |

## 6. Semantic Token Inventory and Architecture

### 6.1 Token Rules

- All semantic tokens are implemented via CSS custom properties mapped exclusively to the official Tailwind CSS color palette.
- Components consume semantic utility classes or CSS custom properties rather than raw palette colors directly.
- The exact mapping of each token remains pending user approval of a design direction.
- Every token pairing (such as `foreground` on `background`, or `primary` contrast text) must satisfy WCAG 2.2 AA contrast ratios:
  - 4.5:1 minimum for normal text (under 18pt/24px or under 14pt/18.66px bold).
  - 3:1 minimum for large text (18pt/24px or larger, or 14pt/18.66px bold or larger).
  - 3:1 minimum for user interface components and graphical boundaries.

### 6.2 Token Definitions

| Semantic Token | Purpose and Usage                                                                  |
| -------------- | ---------------------------------------------------------------------------------- |
| `background`   | Primary page canvas and viewport background                                        |
| `foreground`   | Primary body text and high-contrast content                                        |
| `surface`      | Elevated structural panels, cards, headers, and navigation containers              |
| `primary`      | Dominant interactive elements, primary action buttons, key indicators              |
| `secondary`    | Supporting interactive elements, secondary actions, subdued buttons                |
| `muted`        | Subdued text, secondary labels, disabled backgrounds, placeholder text             |
| `border`       | Structural rules, card borders, dividers, control boundaries                       |
| `focus`        | Keyboard focus ring indicator with high visibility across all themes               |
| `success`      | Affirmative notices, confirmed actions, verified states (must pair with text/icon) |
| `warning`      | Cautionary notices, pending verification states (must pair with text/icon)         |
| `danger`       | Critical alerts, destructive actions, error states (must pair with text/icon)      |
| `info`         | Informational callouts, neutral status notices (must pair with text/icon)          |

### 6.3 Provisional Mapping Specification

The following tables show provisional token mappings across the three candidate directions. These mappings demonstrate feasibility and contrast compliance, while final values remain subject to user approval.

#### Direction 1: Euclidean Institute (Slate + Blue, Dual Theme)

| Token        | Light Mode Value          | Dark Mode Value           | Contrast Target                                               |
| ------------ | ------------------------- | ------------------------- | ------------------------------------------------------------- |
| `background` | `slate-50` (`#f8fafc`)    | `slate-950` (`#020617`)   | Canvas base                                                   |
| `foreground` | `slate-900` (`#0f172a`)   | `slate-100` (`#f1f5f9`)   | >= 14:1 against background                                    |
| `surface`    | `white` (`#ffffff`)       | `slate-900` (`#0f172a`)   | Elevated container                                            |
| `primary`    | `blue-700` (`#1d4ed8`)    | `blue-400` (`#60a5fa`)    | White text in light mode; `slate-950` text in dark mode       |
| `secondary`  | `slate-100` (`#f1f5f9`)   | `slate-800` (`#1e293b`)   | `slate-900` text in light mode; `slate-100` text in dark mode |
| `muted`      | `slate-100` (`#f1f5f9`)   | `slate-800` (`#1e293b`)   | `slate-600` text in light mode; `slate-300` text in dark mode |
| `border`     | `slate-500` (`#64748b`)   | `slate-500` (`#64748b`)   | >= 3:1 where the border defines a control boundary            |
| `focus`      | `blue-600` (`#2563eb`)    | `blue-400` (`#60a5fa`)    | >= 3:1 focus ring against canvas                              |
| `success`    | `emerald-700` (`#047857`) | `emerald-400` (`#34d399`) | White text in light mode; `slate-950` text in dark mode       |
| `warning`    | `amber-400` (`#fbbf24`)   | `amber-400` (`#fbbf24`)   | `slate-950` text in both modes                                |
| `danger`     | `red-700` (`#b91c1c`)     | `rose-400` (`#fb7185`)    | White text in light mode; `slate-950` text in dark mode       |
| `info`       | `sky-700` (`#0369a1`)     | `sky-400` (`#38bdf8`)     | White text in light mode; `slate-950` text in dark mode       |

#### Direction 2: Modern Precision (Zinc + Teal, Dual Theme)

| Token        | Light Mode Value          | Dark Mode Value           | Contrast Target                                             |
| ------------ | ------------------------- | ------------------------- | ----------------------------------------------------------- |
| `background` | `zinc-50` (`#fafafa`)     | `zinc-950` (`#09090b`)    | Canvas base                                                 |
| `foreground` | `zinc-900` (`#18181b`)    | `zinc-100` (`#f4f4f5`)    | >= 14:1 against background                                  |
| `surface`    | `white` (`#ffffff`)       | `zinc-900` (`#18181b`)    | Elevated container                                          |
| `primary`    | `teal-700` (`#0f766e`)    | `teal-400` (`#2dd4bf`)    | White text in light mode; `zinc-950` text in dark mode      |
| `secondary`  | `zinc-100` (`#f4f4f5`)    | `zinc-800` (`#27272a`)    | `zinc-900` text in light mode; `zinc-100` text in dark mode |
| `muted`      | `zinc-100` (`#f4f4f5`)    | `zinc-800` (`#27272a`)    | `zinc-600` text in light mode; `zinc-300` text in dark mode |
| `border`     | `zinc-500` (`#71717a`)    | `zinc-500` (`#71717a`)    | >= 3:1 where the border defines a control boundary          |
| `focus`      | `teal-600` (`#0d9488`)    | `teal-400` (`#2dd4bf`)    | >= 3:1 focus ring against canvas                            |
| `success`    | `emerald-700` (`#047857`) | `emerald-400` (`#34d399`) | White text in light mode; `zinc-950` text in dark mode      |
| `warning`    | `amber-400` (`#fbbf24`)   | `amber-400` (`#fbbf24`)   | `zinc-950` text in both modes                               |
| `danger`     | `red-700` (`#b91c1c`)     | `red-400` (`#f87171`)     | White text in light mode; `zinc-950` text in dark mode      |
| `info`       | `cyan-700` (`#0e7490`)    | `cyan-400` (`#22d3ee`)    | White text in light mode; `zinc-950` text in dark mode      |

#### Direction 3: Scholastic Monograph (Stone + Indigo, Light-Only)

| Token        | Light Mode Value          | Dark Mode Value  | Contrast Target                                    |
| ------------ | ------------------------- | ---------------- | -------------------------------------------------- |
| `background` | `stone-50` (`#fafaf9`)    | N/A (light-only) | Canvas base                                        |
| `foreground` | `stone-900` (`#1c1917`)   | N/A (light-only) | >= 14:1 against background                         |
| `surface`    | `white` (`#ffffff`)       | N/A (light-only) | Elevated container                                 |
| `primary`    | `indigo-700` (`#4338ca`)  | N/A (light-only) | >= 4.5:1 against text/surface                      |
| `secondary`  | `stone-100` (`#f5f5f4`)   | N/A (light-only) | `stone-900` text                                   |
| `muted`      | `stone-100` (`#f5f5f4`)   | N/A (light-only) | `stone-600` text                                   |
| `border`     | `stone-500` (`#78716c`)   | N/A (light-only) | >= 3:1 where the border defines a control boundary |
| `focus`      | `indigo-700` (`#4338ca`)  | N/A (light-only) | >= 3:1 focus ring against canvas                   |
| `success`    | `emerald-800` (`#065f46`) | N/A (light-only) | >= 4.5:1 text against surface                      |
| `warning`    | `amber-900` (`#78350f`)   | N/A (light-only) | >= 4.5:1 text against surface                      |
| `danger`     | `rose-800` (`#9f1239`)    | N/A (light-only) | >= 4.5:1 text against surface                      |
| `info`       | `blue-800` (`#1e40af`)    | N/A (light-only) | >= 4.5:1 text against surface                      |

## 7. Layout, Typography, Spacing, and Interaction Conventions

### 7.1 Typography Baseline

- Font stacks: System font stacks only. No web fonts or external network requests.
  - Sans stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - Serif stack (Direction 3 headings): `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`
  - Monospace stack (for tabular numbers and timestamps): `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`
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

### 7.2 Spacing and Sizing Baseline

- 4px baseline grid following Tailwind default scale (`1` = 4px, `2` = 8px, `3` = 12px, `4` = 16px, `6` = 24px, `8` = 32px, `12` = 48px).
- Containers: Content is constrained to responsive maximum widths:
  - Default layout container: `max-w-5xl` (1024px) or `max-w-7xl` (1280px).
  - Responsive padding: `px-4 sm:px-6 lg:px-8`.
- Touch targets: All interactive elements (buttons, links, controls) must provide a minimum touch target size of 44x44px on touch viewports, or at least 24x24px with sufficient spacing to satisfy WCAG 2.5.8 (Target Size Minimum).

### 7.3 Interaction and Focus Conventions

- Focus visibility: Every focusable element must display a distinct, high-contrast focus indicator when navigated via keyboard:
  - Focus utility: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]`.
  - Suppressing focus outlines with `outline-none` without an explicit accessible replacement is prohibited.
- Hover and active states: Interactive controls must provide subtle, accessible visual feedback on hover and press states without shifting layout geometry.
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

## 8. Minimal Provisional Primitive Inventory

Phase 01 implements a minimal, disciplined set of UI primitives. Complex interactive components are intentionally excluded.

### 8.1 Primitive Specifications

1. `Container`
   - Purpose: Standard layout wrapper providing max-width constraint and responsive horizontal padding.
   - Component type: React Server Component.
   - Props: `children`, `className`, `as` (semantic HTML tag, defaults to `div`).

2. `SkipLink`
   - Purpose: Direct keyboard bypass link jumping immediately to the primary content landmark.
   - Component type: React Server Component.
   - Target: `#main-content`.
   - Behavior: Visually hidden off-screen by default; becomes prominently visible at the top of the viewport when focused via keyboard navigation.
   - Props: `href` (defaults to `#main-content`), `children` (defaults to "Skip to main content").

3. `Button`
   - Purpose: Standard accessible button or button-styled anchor.
   - Component type: Shared presentational component that remains server-renderable. A client caller owns any event handler or local state.
   - Variants: `primary`, `secondary`, `outline`, `ghost`.
   - Sizes: `sm`, `md`, `lg` (all satisfying touch target requirements).
   - Behavior: Native `<button>` for actions and a separate link treatment for navigation. Native buttons use the `disabled` attribute; disabled links use `aria-disabled="true"` and cannot navigate.
   - Props: `variant`, `size`, `disabled`, `children`, `className`, plus native button attributes.

4. `StatusBadge`
   - Purpose: Inline visual status and classification tag.
   - Component type: React Server Component.
   - Variants: `neutral`, `success`, `warning`, `danger`, `info`.
   - Accessibility requirement: Strict compliance with the color-not-only rule. Every badge renders an explicit text label. A supporting icon is decorative and hidden from assistive technology when the label already communicates the state.
   - Props: `variant`, `icon`, `children`, `className`.

5. `Shell`
   - Purpose: Root application layout frame structuring standard page landmarks.
   - Component type: React Server Component.
   - Landmark structure:
     - Banner: `<header>` containing club identification and a future navigation slot.
     - Navigation: `<nav aria-label="Main navigation">` providing primary links.
     - Main content: `<main id="main-content" tabindex="-1">` receiving focus from `SkipLink`.
     - Footer: `<footer>` containing the minimal project and license context appropriate to this phase.
   - Props: `children`.

### 8.2 Primitive Boundaries

- Complex primitives such as modal dialogs, dropdown menus, context menus, comboboxes, drawers, and tabs are intentionally excluded from Phase 01.
- If a future phase requires a complex interactive control, that phase must justify the primitive within its own planning document.

## 9. Route-Level Loading, Error, and Not-Found States

Phase 01 establishes accessible, cohesive route states under the App Router convention:

### 9.1 Loading State (`app/loading.tsx`)

- Component type: React Server Component.
- Behavior: Renders an accessible skeleton shell while server components stream.
- Accessibility: Includes `aria-busy="true"` on the loading container and an accessible screen-reader announcement (`<span className="sr-only">Loading page content...</span>`).
- Layout integration: Renders cleanly inside the root Shell without causing layout shift.

### 9.2 Error State (`app/error.tsx`)

- Component type: Client component (`"use client"`).
- Behavior: React error boundary capturing uncaught render errors in child route segments.
- Content: User-friendly error message, sanitized against leaking stack traces, environment details, or server paths.
- Actions: Accessible "Try again" button invoking the `reset()` callback, plus a navigation link returning to the home page.
- Accessibility: Uses `role="alert"` or an `aria-live="polite"` region to announce the error to assistive technology.

### 9.3 Not-Found State (`app/not-found.tsx`)

- Component type: React Server Component.
- Behavior: Renders when `notFound()` is invoked or an unknown route is accessed.
- Content: Clear statement that the requested page does not exist, accompanied by a navigation link to return home.
- Preserved protections: Preserves standard Shell landmarks, layout styling, and security headers (`X-Robots-Tag: noindex, nofollow, noarchive`).

## 10. WCAG 2.2 AA Requirements and Invariants

The interface foundation must satisfy WCAG 2.2 AA standards:

1. Color Contrast (WCAG 1.4.3, 1.4.11)
   - Normal text: At least 4.5:1 contrast ratio against the underlying surface.
   - Large text (>= 24px regular or >= 18.66px bold): At least 3:1 contrast ratio.
   - UI components and graphical objects: At least 3:1 contrast ratio against adjacent surfaces for interactive boundaries and focus indicators.

2. Color-Not-Only Rule (WCAG 1.4.1)
   - Color must never serve as the sole mechanism for conveying information, indicating an action, prompting a response, or distinguishing a visual element.
   - Status badges, form alerts, and interactive states must combine color with explicit text labels, accessible icons, weight differences, or underline styling.

3. Keyboard Accessibility and Focus (WCAG 2.1.1, 2.1.2, 2.4.7, 2.4.11, 2.4.13)
   - Every interactive control must be operable via standard keyboard interactions.
   - No keyboard traps.
   - Highly visible focus rings on all focused elements with minimum 3:1 contrast against surrounding colors.

4. Page Structure and Landmarks (WCAG 1.3.1)
   - Semantic HTML5 landmarks (`header`, `nav`, `main`, `footer`).
   - Logical heading sequence (`h1` through `h3`) without missing intermediate levels.

5. Skip Link (WCAG 2.4.1)
   - Accessible bypass mechanism as the first focusable element on every page, navigating directly to `#main-content`.

6. Target Size (WCAG 2.5.8)
   - Minimum target size of 24x24px, with primary interactive controls targeting 44x44px.

7. Motion and Animation (WCAG 2.3.3)
   - Motion and transition effects must honor `prefers-reduced-motion: reduce`.

## 11. Dependency Policy and shadcn/ui Decision

The repository currently maintains a minimal, locked dependency graph:

- Next.js `16.3.3`
- React / React DOM `19.2.8`
- Tailwind CSS `4.3.3`
- Vitest `4.1.11`, React Testing Library `16.3.3`, Playwright `1.62.1`

### Decision on shadcn/ui

- Architecture stance (`architecture.md` Section 5 and Section 14): "shadcn/ui, selectively - Use for complex accessible controls; it does not define LOGOS visual identity."
- Phase 01 evaluation: The primitives required in this phase (Container, SkipLink, Button, StatusBadge, Shell, route states) are lightweight, standard HTML elements easily authored with clean, accessible React code and Tailwind utility classes.
- Explicit decision: shadcn/ui adoption is pending and is judged unnecessary for Phase 01.
- No shadcn CLI, Radix UI packages, or third-party component libraries will be installed in Phase 01.
- Introducing shadcn/ui is deferred until a later phase (such as Phase 07 or Phase 09) demonstrates a concrete requirement for a complex interactive control (such as an accessible combobox, calendar picker, or modal dialog) that justifies third-party runtime dependencies.

## 12. Automated Verification and Test Plan

Phase 01 establishes a dual-tier automated test suite covering unit, accessibility, and browser integration scenarios.

### 12.1 Vitest and React Testing Library Suite

- Primitive unit tests:
  - `Container`: Verifies rendering, custom tag support, class pass-through.
  - `SkipLink`: Verifies accessible role, default link text, target `#main-content`, and focus visibility classes.
  - `Button`: Verifies button vs anchor element rendering, variant and size classes, disabled state (`aria-disabled`), keyboard trigger event handling.
  - `StatusBadge`: Verifies rendering of all five variants, inclusion of explicit text/icon content (color-not-only rule), and ARIA attributes.
  - `Shell`: Verifies semantic landmarks (`banner`, `navigation`, `main`, `contentinfo`), presence of skip link target, and children rendering.
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
   - Evaluates on each viewport: `document.documentElement.scrollWidth <= window.innerWidth` (zero horizontal overflow).

4. Reduced Motion
   - Emulates `prefers-reduced-motion: reduce` in the browser context.
   - Asserts transitions and animations are disabled or have zero duration.

5. Accessibility and Contrast Verification
   - Evaluates color contrast across all rendered text and interactive controls against WCAG 2.2 AA thresholds.
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

1. `docs: record approved design direction and token mapping`
   - Documents the user's selected design direction and establishes approved token mappings.
2. `feat: implement semantic tokens and baseline typography`
   - Configures CSS custom properties and Tailwind utilities for semantic tokens, typography scales, and system font stacks.
3. `feat: add core accessible ui primitives`
   - Implements `Container`, `SkipLink`, `Button`, `StatusBadge`, and `Shell` components.
4. `feat: create application shell and route state templates`
   - Implements the root layout shell, `app/loading.tsx`, `app/error.tsx`, and `app/not-found.tsx`.
5. `test: add unit and browser accessibility tests`
   - Adds Vitest/RTL component tests and Playwright Chromium end-to-end tests covering landmarks, skip link, viewports, overflow, reduced motion, headers, and contrast.
6. `docs: complete phase 01 interface foundation`
   - Updates planning documentation with completion evidence, test results, and Phase 02 handoff details.

Each commit must be atomic, contain one coherent concern, pass local quality checks, and avoid introducing secrets or unapproved dependencies.

## 14. System Boundaries and Invariants

- Zero-cost boundary: All implementation runs within Vercel Hobby and GitHub Free tiers. No paid services, APIs, or infrastructure add-ons may be introduced.
- Synthetic-data boundary: Only synthetic placeholder content and neutral text may be used. Real student names, email addresses, club rosters, or legacy Google Form data are strictly prohibited.
- Dormant Production boundary: The Vercel Production deployment remains pinned to the dormant `production-disabled-until-phase-11` branch. The custom domain `tislogos.org` serves no production traffic. Merging to `main` produces only an access-protected Preview deployment.
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

1. User design approval: A candidate design direction has been explicitly selected and approved by the user, and the selection is recorded in planning documentation.
2. Semantic tokens implemented: Semantic color tokens are defined via CSS custom properties mapped to official Tailwind CSS palette steps in accordance with the approved direction.
3. Primitives delivered: `Container`, `SkipLink`, `Button`, `StatusBadge`, and `Shell` are implemented, documented, and exported.
4. Route states delivered: Accessible `app/loading.tsx`, `app/error.tsx`, and `app/not-found.tsx` states are implemented and integrated into the application shell.
5. Keyboard navigation and focus: Full keyboard navigability is verified; focus rings are visible on all interactive elements with minimum 3:1 contrast against adjacent colors.
6. Skip link verified: The skip link is the first focusable element and jumps keyboard focus directly to `#main-content`.
7. Color-not-only rule satisfied: All status badges and alerts provide text or icon identifiers alongside color styling.
8. WCAG 2.2 AA contrast verified: Normal text achieves at least 4.5:1 contrast; large text and UI boundaries achieve at least 3:1 contrast.
9. Responsive and overflow verified: Layout renders cleanly across mobile (375px, 390px), tablet (768px), and desktop (1280px, 1440px, 1920px) viewports with zero horizontal overflow down to 320px width.
10. Reduced motion verified: Animations and transitions are disabled or instantaneous under `prefers-reduced-motion: reduce`.
11. Dependency policy respected: shadcn/ui evaluation is recorded and no unapproved third-party component libraries are installed.
12. Security protections preserved: All baseline security headers in `proxy.ts` and `noindex, nofollow, noarchive` robots directives are active on all routes and error states.
13. Automated tests pass: Vitest/RTL unit tests and Playwright Chromium end-to-end tests pass cleanly.
14. Aggregate verification passes: `pnpm check` executes formatting, linting, type-checking, unit tests, build, and end-to-end tests without errors.
15. Clean repository: No secrets, credentials, environment files, or real student data exist in the branch.
16. Commit checkpoints recorded: Implementation consists of coherent Conventional Commits on the feature branch.

## 16. Handoff to Phase 02

Upon satisfying the completion gate, Phase 01 hands off:

- A stable, responsive application shell and semantic token system.
- Reusable accessible UI primitives ready for data-driven views.
- Standard route loading, error, and not-found templates.
- An expanded test suite covering component accessibility and browser layout behavior.
- Documented design tokens ready to style future forms and data tables.

Phase 02 (Data and environment foundation) builds upon this foundation to introduce Neon PostgreSQL in Singapore, Drizzle ORM, version-controlled migrations, least-privilege database roles, and synthetic fixtures without needing to revise or refactor the user interface architecture.
