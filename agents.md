# AGENTS.md — Website Project Rules (Read First)

You are working in a React/Vite web app. Your priorities, in order:
1) Responsive UI (no mobile breakage)
2) Uniform design system (no one-off styling)
3) Performance (no regressions)
4) Accessibility (keyboard + semantics)

## Non-Negotiables
- No horizontal scrolling on mobile. Ever.
- Reuse existing components/variants before creating new ones.
- Use design tokens (spacing/type/colors). No random hex values.
- Keep diffs small and reviewable. Prefer refactors over rewrites.
- Do not change visual style unless the task requires it.

## Responsive Standards
Test at minimum:
- 390×844 (mobile)
- 768×1024 (tablet)
- 1024×768 (small desktop)
- 1280×800 (desktop)

Rules:
- Use fluid containers with max widths; avoid fixed widths.
- Touch targets: 44px minimum.
- Avoid hard-coded heights for content containers unless necessary.
- Prefer CSS grid/flex patterns already used in the repo.

## Style System Rules (Uniformity)
- Use existing spacing scale (4/8-based). No arbitrary spacing values.
- Typography must come from the existing type scale.
- Buttons/inputs/cards must use existing shared components and variants.
- If you must add a new variant, update the shared component and document it.



## Performance Rules
- Optimize images: correct dimensions, lazy-load below fold, prefer modern formats.
- Avoid shipping heavy dependencies for small UI wins.
- Prefer route-level code splitting when it reduces initial bundle.
- Avoid layout shift (CLS): reserve space for images/video, stable header heights.

## Accessibility Rules
- Focus states must be visible.
- Use semantic HTML first; ARIA only when needed.
- Forms must have labels, errors must be announced/readable.

## Workflow Requirements
Before concluding work:
- Run: lint, typecheck (if present), and build.
- Do a quick manual smoke check:
  - Nav works
  - Mobile layout doesn’t overflow
  - Primary pages render
  - Key buttons/inputs usable

## “Agents” to Emulate (Use as roles while working)
### UI Systems Steward
Goal: enforce tokens, consistent components, consistent style.

### Responsive Layout Engineer
Goal: fix layout across breakpoints; eliminate overflow; ensure touch usability.

### Performance Surgeon
Goal: reduce JS/image cost; prevent CLS; improve Lighthouse-critical issues.

### Accessibility Enforcer
Goal: keyboard navigation, focus visibility, semantics, form correctness.

### Codebase Consistency Reviewer
Goal: naming, patterns, folder structure, no duplicated utilities.

### QA / Regression Scout


## Output Expectations
When making changes, include:
- What changed (1–3 bullets)
- Why (1–2 bullets)


# Styling + Semantics (Doctrine Modules)

Goal: make HTML semantic + maintainable without changing layout/visuals.

Rules:
- Do NOT change layout, spacing, colors, or structure. Only refactor repeated class blobs into semantic classes using @apply.
- Replace repeated article wrapper classes with: module-card
- Replace repeated header wrapper classes with: module-head
- Second doctrine article inner wrapper uses: doctrine-column (grid gap-4 lg:grid-cols-2)
- Doctrine blocks use: doctrine-block and variants:
  - doctrine-block
  - doctrine-block-steps
  - doctrine-block-failure
  - doctrine-block-validation
- Avoid repeating framework-modern-* utility stacks in markup once semantic classes exist.
- Keep existing DOM tags (article/header/section/h2/ul) unless a tag is outright wrong.
Definition of done:
- Doctrine page renders identical.
- Repeated framework-modern-* strings removed from doctrine page markup.
- New classes live in Tailwind @layer components.

## Cursor Cloud specific instructions

This is a single-service client-side SPA (React + Vite + TypeScript). No backend, database, or external services are required.

### Key commands

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Dev server | `npm run dev` (serves on `http://localhost:5173`) |
| Lint | `npm run lint` |
| Build (typecheck + bundle) | `npm run build` |
| Content validation | `npm run content:check` |

### Notes

- The Vite dev server starts on port 5173 by default. There is no `.env` file needed.
- `npm run build` runs `tsc -b` (TypeScript check) followed by `vite build`, so it serves as both typecheck and production build.
- Husky is set up for commit-msg hooks (commitlint with conventional commits). The `prepare` script installs hooks automatically during `npm install`.
- Content lives in `content/modules/*.mdx` and `content/refs/*.mdx`. Run `npm run content:check` to validate frontmatter and references after editing content files.
- The build produces a warning about chunk size (>500 kB) for the main bundle — this is expected and not a build failure.