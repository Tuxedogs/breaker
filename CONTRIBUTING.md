# Contributing Content (No Coding Required)

This project supports content-only contributions for game updates and mechanics changes.

## What You Should Edit

- `content/modules/*.mdx`: doctrine modules
- `content/refs/*.mdx`: references, maps, diagrams, keybind docs

Do not edit `src/` unless you are a core maintainer.

## Quick Workflow

1. Open the file in GitHub and click the pencil icon (`Edit this file`).
2. Update frontmatter fields and body text for the new game patch.
3. Open a Pull Request using the content template.
4. Wait for checks and reviewer approval.

## Frontmatter Rules

- Keep `id` equal to filename (without `.mdx`).
- Keep `type` as:
  - `module` for `content/modules`
  - `reference` for `content/refs`
- Use status values: `draft`, `review`, `validated`.
- Use dates in `YYYY-MM-DD` format.
- Arrays must be JSON-style, for example:
  - `tags: ["perseus", "pilot"]`
- Optional audience exclusions:
  - `excludeShips: ["mantis"]`
  - `excludeRoles: ["engineer"]`

## Update Checklist

- Confirm title and summary match the current game patch.
- Update `lastValidated` (modules) or `lastUpdated` (refs).
- Verify linked module IDs/maps still exist.
- Add source links and patch notes in the PR description.

## Core Maintainers

Core maintainers handle:

- UI/code changes (`src/`)
- schema/validation updates
- release + deployment steps
