# UI checklist

Covers how the interface looks, adapts and performs. Cite items in `checklistRef` as `ui.md#<ID>` (e.g. `ui.md#UI-02`).

## UI-01 — Design system

- The code uses design system tokens: no hard-coded colors, spacing, radii, shadows or fonts.
- Existing components are reused before new ones are created.

## UI-02 — Contrast

- Text contrast is at least 4.5:1 (3:1 for large text) (1.4.3).
- UI components, field borders and informative icons reach 3:1 (1.4.11).
- Information never relies on color alone (1.4.1).

## UI-03 — Responsive layout

- The layout works at 320 px with no horizontal scroll (1.4.10).
- The project's breakpoints are respected and tested.
- Text scaled to 200% loses no content (1.4.4), and text spacing can be adjusted (1.4.12).
- The dark theme is covered when the project supports it.

## UI-04 — Hierarchy and rhythm

- The type hierarchy is clear: one main heading per screen and a consistent scale.
- Alignment and spacing follow the project grid.

## UI-05 — Component states

- New components have hover, focus, active, disabled, loading and error states.
- Skeletons and placeholders have the dimensions of the final content.

## UI-06 — Core Web Vitals (75th percentile)

- **LCP ≤ 2.5 s**: the main image is prioritized, and nothing above the fold is lazy-loaded.
- **INP ≤ 200 ms**: event handlers stay light, there are no long tasks on the main thread, and heavy work is deferred or moved to a worker.
- **CLS ≤ 0.1**: images and media have `width`/`height` or `aspect-ratio`, and space is reserved for async content and banners.

## UI-07 — Weight

- Images use modern formats, are sized correctly, and are lazy-loaded below the fold.
- Any new bundle is justified, and anything not needed on the first screen uses a dynamic import.
- Fonts use an appropriate `font-display` and don't ship unused variants.
