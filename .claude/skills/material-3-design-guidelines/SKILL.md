---
name: material-3-design-guidelines
description: >
  Generic, platform-agnostic Material Design 3 (MD3 / Material You) design language — the
  transferable design principles only: color-as-roles and tonal pairing, tonal elevation,
  the type scale, the shape scale, spring/easing motion, and adaptive layout (window size
  classes + canonical layouts), plus the core anti-patterns. Deliberately excludes platform
  implementation (Jetpack Compose / Flutter / @material/web) and framework-specific tokens.
  Use to ground visual/UI design decisions in MD3 thinking. Triggers: "material design",
  "MD3", "material you", "design language", "tonal color", "surface containers", "type
  scale", "elevation", "adaptive layout". For full multi-platform component code and token
  tables, see the companion `material-3` skill.
user-invokable: true
argument-hint: "[color|type|shape|elevation|motion|layout]"
---

# Material 3 — Generic Design Language

The platform-agnostic Material Design 3 (Material You) design *language* — the transferable
design thinking, with **no** platform implementation and **no** framework-specific tokens.
Apply these principles when making visual / UI design decisions so the result reads as MD3
regardless of the stack it ships on.

## Scope & relationship to other skills

- **This skill** = the MD3 design principles (the "why" and "what"), distilled to what
  transfers across any platform.
- **Implementation detail** (component code, token tables for Jetpack Compose, Flutter, or
  `@material/web`) lives in the companion **`material-3`** skill — reach for that when you
  need concrete elements or the `--md-sys-*` token catalog.
- **Orientation for this workspace (not the focus here):** dbx-components already implements
  M3 via Angular Material 21 — the same semantic roles exist as `--mat-sys-*` system tokens
  with a `--dbx-*` alias layer. Mapping these principles onto that surface is a separate,
  deferred concern; keep this skill generic.

## Three foundational principles

- **Personal** — Color is generated from a single seed (or user wallpaper / in-app content),
  so theming is individual, not one-size-fits-all. Design against *roles*, never fixed colors.
- **Adaptive** — One UI flexes across 5 window size classes; components resize, reposition,
  and change form factor (bottom bar → rail → drawer). Design for a *range* of widths, never
  one phone.
- **Expressive** (May 2025 update) — Shape morphing, spring physics, and emphasized type add
  moments of delight without sacrificing usability.

## Color — semantic roles, generated, always paired

- **Roles, not literals.** ~29 semantic roles: `primary` / `secondary` / `tertiary` (each
  with a `-container`), `surface` + five `surface-container` levels, `error`, `outline` vs
  `outline-variant`, `inverse-*`, and `fixed-*`. You design against roles; the actual hues are
  generated.
- **Generated from a seed.** One seed → 5 tonal palettes (primary, secondary, tertiary,
  neutral, neutral-variant), each sampled along tones 0–100. Light vs dark simply remap which
  tone fills which role (e.g. `primary` = tone 40 in light, tone 80 in dark).
- **The pairing rule (the single most important one).** Every fill has a matching "on" color:
  `primary`+`on-primary`, `surface-container`+`on-surface`, `error`+`on-error`. Never pair a
  foreground/background outside its intended pair — it breaks the guaranteed contrast,
  especially under dark mode and high-contrast.
- **Surface containers create hierarchy.** Use `surface` for the base background and the five
  `surface-container-{lowest…highest}` levels for nesting / depth (cards, nav areas, panes)
  instead of arbitrary greys.
- **`outline` vs `outline-variant`.** `outline` = meaningful boundaries needing 3:1 contrast
  (text-field borders). `outline-variant` = decorative (dividers, subtle borders). Don't swap
  them.
- **Error is static** — it does not shift with the seed / dynamic color.
- **Three contrast levels** (standard / medium / high) widen the tonal distance between paired
  roles for accessibility without changing the overall color feel.

## Elevation — depth by tone, not shadow

- MD3 communicates elevation through **surface tone** (a higher level = a more prominent
  `surface-container` step), **not** drop shadows. Six conceptual levels (0–5) map onto the
  surface-container hierarchy.
- Reserve **shadows** only for elements floating over busy / unpredictable content (e.g. a
  FAB over imagery) or when tone alone can't separate overlapping layers.

## Typography — one role-based scale

- **5 roles × 3 sizes = 15 styles**: Display, Headline, Title, Body, Label (each
  Large/Medium/Small), plus 15 higher-weight **emphasized** variants for selected / active /
  important content.
- **Two typeface roles**: *Brand* (Display + Headline, expressive) and *Plain* (Title + Body
  + Label, readable). Default Roboto / Roboto Flex.
- **Apply by semantic role, not by eyeballing px.** Conventions: button = Label Large; card
  title = Title Medium; body copy = Body Medium/Large; top-bar title = Title Large; dialog
  headline = Headline Small; nav label = Label Medium.

## Shape — a corner scale used by role

- Scale: `none / extra-small (4) / small (8) / medium (12) / large (16) / extra-large (28) /
  full (pill)`, plus Expressive increases (20 / 32 / 48).
- Per-role conventions: buttons, chips, FAB → `full` / `large`; cards → `medium`; dialogs &
  sheets → `extra-large`; text fields & menus → `small`. Use the scale — not magic radii.
- **Shape morphing** (Expressive): components can change shape on interaction (press, select,
  progress) as an expressive cue.

## Motion — springs for components, easing for transitions

- **Spring physics** (Expressive) drive component motion — no fixed duration; motion responds
  to input. Two characters: *standard* (utilitarian) and *expressive* (bouncier).
- **Easing + duration tokens** govern transitions (enter / exit / shared-axis):
  - *Emphasized* set for most on-screen transitions (the signature MD3 feel); *Standard* set
    for small utility motion.
  - Typical pairings: stays-on-screen ≈ emphasized / 500ms; enters ≈ emphasized-decelerate /
    400ms; exits permanently ≈ emphasized-accelerate / 200ms.
- Always respect reduced-motion preferences.

## Layout & adaptivity

- **5 window size classes** (branch on these, not device names): Compact `<600` / Medium
  `600–839` / Expanded `840–1199` / Large `1200–1599` / Extra-large `1600+`.
- **3 canonical layouts** — start from one rather than a raw grid:
  - *Feed* — browsable grid; column count scales up with width.
  - *List-detail* — list + detail; single-pane on compact, side-by-side at 600+.
  - *Supporting pane* — primary content plus a supplementary panel.
- **Margins & gutters scale** with size class (≈16dp margins compact → 24dp medium+; gutters
  8→24dp). Spacing rides a **4dp / 8dp grid**.
- **Constrain readable width** on large screens (~840–1040dp max for body text); spend extra
  width on more panes, not longer lines.
- **Navigation transforms by size**: 2 destinations → tabs; 3–5 → bottom bar (compact) → rail
  (medium) → drawer (expanded+); 6+ → drawer. The active destination gets a
  `secondary-container` indicator.
- **Foldables are first-class**: never place interactive / critical content across a hinge;
  map book posture → list-detail, tabletop → content-top / controls-bottom.

## Design discipline (anti-patterns, framed as principles)

- Use **tokens / roles, never hardcoded hex** — keeps theming, dark mode, and contrast
  adjustment working.
- **Honor tonal pairing** — only `on-X` on `X`.
- **Express elevation with tone**; add a shadow only when genuinely needed.
- **Use the shape scale**, not arbitrary `border-radius`.
- **Design adaptive, not phone-only** — multi-pane at 600dp+, readable max width on wide
  screens.
- Don't mix Material generations or component libraries within one surface.

## M3 Expressive (May 2025) — the "delight" layer

Adds: emphasized type, new button sizes (XS–XL) and shapes, spring motion schemes, shape
morphing, three contrast levels, richer adaptive scaffolds, and new form-factor guidance
(watch / XR). Availability varies by platform — treat it as enhancement layered over the
stable token foundation above, not as a replacement for it.
