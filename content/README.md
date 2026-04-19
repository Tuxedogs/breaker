# Content Authoring Cheatsheet

This folder contains doctrine content written in MDX. Module pages live in
`content/modules/*.mdx`; reference pages live in `content/refs/*.mdx`.

Run this after content edits:

```bash
npm run content:check
```

If you touched layout-sensitive content, also run:

```bash
npm run lint
npm run build
```

## Module Frontmatter

Every module starts with frontmatter:

```mdx
---
id: "sub-targeting"
title: "Sub-Targeting"
type: "module"
status: "validated"
moduleType: "concept"
owner: "Doctrine Team"
summary: "Short summary shown on cards and headers."
validatedDate: "2026-02-26"
tags: ["sub-targeting", "gunner"]
ships: []
roles: ["pilot", "gunner"]
enemies: ["capital"]
prerequisites: []
relatedModuleIds: ["component-sniping"]
---
```

Valid `moduleType` values:

```md
procedure
framework
reference
concept
diagram
checklist
```

All modern module layouts share the same body styling now, so tables, images,
video clips, lists, blockquotes, and code can be used in any module type.

## Tables

Use normal Markdown table syntax. The first row controls the table headers.

```mdx
| Action | Baseline | Why it matters |
| --- | --- | --- |
| Cycle Sub-Target Forward | `R` | Cycles through sub-targets while in precision mode |
| Select MFD 2 | `Left Alt + E` | Keeps comms and targeting access familiar |
```

To change headers, edit the first row:

```mdx
| Setting | Recommended value | Notes |
| --- | --- | --- |
| Precision Lines | `Yes` | Helps maintain deliberate aim placement |
```

Table rules:

- Keep the separator row: `| --- | --- | --- |`
- Every row should have the same number of columns.
- Use backticks for keybinds, settings values, commands, and short UI labels.
- Do not prefix table rows with `>` or `##`; that turns them into blockquotes or headings.
- Tables automatically stack on mobile to prevent horizontal page overflow.

## Images

Use Markdown image syntax for regular inline images:

```mdx
![Perseus range bands](/images/diagrams/perseus-engagement-range-bands.svg)
```

Image rules:

- Put public assets under `public/`.
- Reference public assets from the site root: `/images/...`, `/ships/...`, etc.
- Add useful alt text inside `![...]`.
- Images are constrained to the content width and styled by shared doctrine content CSS.

For diagram modules, prefer frontmatter when the image is the primary asset:

```mdx
---
moduleType: "diagram"
assetPath: "/images/diagrams/perseus-engagement-range-bands.svg"
caption: "One canonical image defines the operating bands."
legend:
  - color: rgb(58 152 96)
    label: 0-500m engagement range
---
```

## Video Clips

For a basic inline video:

```mdx
<video src="/images/video/percy-position.mp4" preload="metadata" controls playsInline />
```

For the framed doctrine video style:

```mdx
<div className="dm-inline-video">
  <div className="dm-inline-video-frame">
    <video src="/images/video/percy-position.mp4" preload="metadata" controls playsInline />
  </div>
  <p className="dm-inline-video-caption">Relative geometry clip</p>
</div>
```

Video rules:

- Use `controls` for clips users need to inspect.
- Use `preload="metadata"` unless the clip must autoplay.
- Use `playsInline` for mobile behavior.
- Keep clips compressed and reasonably sized.

## Headings

Use Markdown headings for sections:

```mdx
## When To Cycle Sub-Targets

### Confirmation Checks
```

Heading rules:

- The page title comes from frontmatter; do not add another `# Title` in the body.
- Use `##` for major body sections and `###` for subsections.

## Lists

Use normal Markdown lists:

```mdx
- Initial armor burn for friendlies with smaller weapons.
- You need raw pressure more than precision.
- The target is already near destruction.
```

Numbered lists are also fine:

```mdx
1. Confirm precision mode.
2. Aim near the intended component.
3. Cycle to the needed subsystem.
```

## Callouts

Use a blockquote for a lightweight doctrine callout:

```mdx
> Reset the lock if the game state becomes ambiguous instead of guessing.
```

## Inline Code

Use backticks for keybinds, values, commands, and exact UI labels:

```mdx
Press `R`, then confirm the selected subsystem in precision mode.
```

## Links

Use Markdown links:

```mdx
[Sub-Targeting](./sub-targeting)
```

For module relationships shown by the app, prefer frontmatter:

```mdx
relatedModuleIds: ["component-sniping", "turret-keybind-baseline"]
prerequisites: ["keybind/turret-bind-baseline"]
```

## Common Gotchas

- A table must have a header row and separator row.
- A row starting with `>` is a blockquote, not a table row.
- A row starting with `##` is a heading, not a table row.
- Public files are referenced from `/`, not from `public/`.
- Keep `id` values stable; links and relationships depend on them.
- Run `npm run content:check` after changing frontmatter or MDX syntax.
