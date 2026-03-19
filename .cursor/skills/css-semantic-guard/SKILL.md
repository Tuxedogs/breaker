---
name: css-semantic-guard
description: Enforces semantic CSS architecture and prevents stylesheet bloat by requiring tokens, component-scoped patterns, and duplication cleanup. Use when editing CSS, Tailwind utility-heavy markup, style refactors, UI bug fixes, or when users mention semantic styling, CSS cleanup, runaway stylesheets, specificity issues, or maintainability.
---

# CSS Semantic Guard

## Mission

Keep styles semantic, predictable, and bounded in size. Prefer reusable component classes and tokens over one-off utility/class sprawl.

## When to Apply

Apply this skill when:
- Any `*.css`, `*.scss`, or Tailwind-heavy JSX/TSX markup is changed
- A user asks for CSS cleanup, semantic classes, or style consistency
- Repeated class blobs appear in component markup
- New UI work risks adding many ad-hoc selectors or overrides

## Core Rules

1. Preserve existing visual design unless explicitly asked to restyle.
2. Use design tokens and existing spacing/type/color scale; no random values.
3. Prefer semantic component classes (`module-*`, `*-card`, `*-head`) over repeated utility blobs.
4. Keep specificity low; avoid escalating with deep descendant chains or `!important`.
5. Co-locate styles by feature and remove dead/duplicated selectors as part of edits.
6. Block stylesheet growth when no new capability is added (refactor instead of append).

## Runaway Stylesheet Prevention Checklist

Before finalizing CSS-related changes, verify:

- [ ] **Reuse-first**: existing class/variant checked before creating new selectors
- [ ] **Duplication removed**: repeated utility stacks consolidated into semantic classes
- [ ] **Selector discipline**: avoid selectors deeper than 3 levels when possible
- [ ] **No panic overrides**: no new `!important` unless documented with reason
- [ ] **Token alignment**: spacing/type/colors come from established design tokens
- [ ] **Mobile safety**: no horizontal overflow at common mobile viewport sizes
- [ ] **Net complexity check**: CSS complexity is stable or reduced (rules/lines/selectors)

## Workflow

1. Identify repeated class patterns and current style ownership.
2. Extract/rename to semantic classes in the appropriate stylesheet layer.
3. Replace repeated markup classes with semantic class names.
4. Delete obsolete selectors introduced by the refactor.
5. Validate responsive behavior and focus states are unchanged.
6. Run lint/typecheck/build when code changes are substantive.

## Decision Heuristics

- **If a style is used in 2+ places**: create/reuse a semantic class.
- **If only one tiny exception exists**: keep local utility class instead of creating noise.
- **If a new class duplicates 80% of another**: create a shared base class + variant.
- **If adding styles increases file size significantly**: stop and refactor first.

## Response Contract (for the agent using this skill)

When reporting style changes, provide:
- What changed (1-3 bullets)
- Why it was needed (1-2 bullets)
- Any residual risk (overflow/specificity/a11y) if not fully verifiable
