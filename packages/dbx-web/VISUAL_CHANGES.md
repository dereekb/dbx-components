# Visual Changes Ledger — dbx-web + dbx-form (v13 → v14)

This ledger records every intentional **visual** change made during the breaking
visual-simplification pass over `@dereekb/dbx-web` and `@dereekb/dbx-form`. It is the
review surface for each batch and the source for the v13 → v14 downstream release notes
(cross-linked from the root [`VERSION_MIGRATION.md`](../../VERSION_MIGRATION.md)).

The pass burns down the M2-era visual tech debt that the rendering-identical tokenization
pass (commit `3c92a4157`) deliberately deferred, leaning the component defaults onto
Angular Material **M3** system tokens.

## How to read this ledger

Each entry lists the file, the before → after rule, and the resulting visual delta.
Screenshots were **not** captured for this pass (maintainer decision); to preview a batch
yourself, serve the demo and mount the showcase:

```bash
npm exec nx serve demo   # http://localhost:9010
# Showcase playground: /#/doc/examples/playground
# Chips:               /#/doc/text
# Layout / dividers:   /#/doc/layout
# Interaction:         /#/doc/interaction
# Forms:               /#/doc/form
```

Dark mode in the demo has no UI toggle — swap the root class `doc-app` → `doc-app-dark`
(the `DbxStyleService` suffix mechanism, `src/lib/layout/style/style.service.ts`).

`KEEP-n` entries record literals intentionally left in place, each with the criteria that
would later justify removing or tokenizing it.

---

## Batch 1 — Dead SCSS variable deletion (zero-risk, non-breaking)

Compiled CSS is **byte-identical** before/after (these Sass variables had zero consumers,
so they emitted no CSS). No visual delta. Proven by building `demo` before and after:
both produced `dist/apps/demo/browser/styles-43NNETPY.css`,
sha256 `3a9ff611779296eb863cf7c83484e232e26fda469dd09f7c09f790eba9b5c36f`.

| File | Removed | Notes |
|---|---|---|
| `src/lib/interaction/dialog/_dialog.scss:5-8` | `$mat-dialog-close-icon-size`, `$mat-dialog-close-icon-half-size`, `$mat-dialog-container-padding`, `$mat-dialog-container-close-button-padding` | Also drops a deprecated Sass `/` division. Close offsets use the separate `$dbx-dialog-content-close-*` vars (kept). |
| `src/lib/interaction/popup/_popup.scss:10` | `$dbx-popup-border-radius` | |
| `src/lib/interaction/detach/_detach.scss:8` | `$dbx-detach-border-radius` | |
| `src/lib/layout/section/_section.scss:10` | `$header-bottom-margin` | |
| `dbx-form `…`/formly/field/value/date/_date.scss:4-7` | `$dbx-datetime-button-spacing`, `$dbx-datetime-date-and-time-spacing`, `$dbx-datetime-button-width`, `$dbx-datetime-row-width` | Entire chain was self-referential and unused. |
| `dbx-form `…`/formly/field/wrapper/_wrapper.scss:4-5` | `$form-flex-section-group-padding`, `$form-flex-section-group-item-padding` | |

---

## Batch 2 — Remove `m2-visual-compat()`, unify on `dbx-components-shapes()` (BREAKING)

The `m2-visual-compat()` mixin restored M2-era component shapes when theming with M3. It is deleted;
the only shape mixin dbx-web ships now is `dbx-components-shapes()` (the restrained 8px house style).
The partial was renamed `_m2-visual-compat.scss` → `_shapes.scss` and `_index.scss` forwards only
`dbx-components-shapes`. Downstream migration is documented in
[`VERSION_MIGRATION.md`](../../VERSION_MIGRATION.md) (v13 → v14).

**Code changes**

| File | Change |
|---|---|
| `src/lib/style/_m2-visual-compat.scss` → `_shapes.scss` | renamed; `m2-visual-compat()` mixin deleted (kept `dbx-components-shapes()`) |
| `src/_index.scss:19` | `@forward './lib/style/shapes' show dbx-components-shapes;` (dropped `m2-visual-compat`) |
| `src/lib/style/_style-demo.scss:13` | stale comment reference updated to `_shapes.scss` |
| `apps/demo/src/style/_doc.scss:67` (dark-doc theme) | `m2-visual-compat()` → `dbx-components-shapes()` |
| `apps/demo/src/app/modules/demo/style/_demo.scss:32` (alt demo theme) | `m2-visual-compat()` → `dbx-components-shapes()` |
| `setup/templates/apps/app/src/style/_app.scss:36,66` (new-app scaffold, light + dark) | `m2-visual-compat()` → `dbx-components-shapes()` |

**Visual delta** (anywhere the swapped themes apply — demo dark mode, the alternate demo theme, and
freshly-scaffolded apps; the demo light theme was already on `dbx-components-shapes()`):

- buttons, FAB, cards, dialogs, form-fields, snackbar, menu, autocomplete, expansion panel,
  datepicker, bottom sheet, tooltip: corner radius **4px → 8px**
- chips: **16px (pill) → 8px**
- list active indicator: **0 → 2px**
- sidenav: 0 → 0 (unchanged)

Net effect: a slightly softer, more consistent M3-aligned rounding; the old square-ish M2 look is gone.

---

## Batch 3 — Color literals + pill radii → M3 role tokens

Hardcoded alpha-black dividers, hex placeholders, the legacy MDC error color, and two literal
"pill" radii are replaced with M3 role tokens. These are not app override points (divider / error /
shape roles), so no new `--dbx-*` tokens are introduced. The visible win is in **dark mode**: the
black-alpha dividers were nearly invisible on dark surfaces and now track `--mat-sys-outline-variant`,
which adapts per theme.

| File:line | Before → After | Delta |
|---|---|---|
| `dbx-web …/interaction/popup/_popup.scss:39` (`.dbx-popup-controls`) | `1px solid rgba(0,0,0,0.15)` → `1px solid var(--mat-sys-outline-variant)` | theme-aware divider; visible in dark |
| `dbx-web …/interaction/detach/_detach.scss:32` (`.dbx-detach-controls`) | same | same |
| `dbx-web …/layout/column/_column.scss:87` (`.dbx-two-column-head`) | `rgba(0,0,0,0.14)` → `var(--mat-sys-outline-variant)` | same |
| `dbx-form …/formly/field/selection/sourceselect/_sourceselect.scss:23` | `rgba(0,0,0,0.12)` → `var(--mat-sys-outline-variant)` | same |
| `dbx-form …/formly/field/checklist/_checklist.scss:36` | `1px solid black` → `1px solid var(--mat-sys-outline-variant)` | pure-black left border softens to the M3 outline-variant |
| `dbx-form …/formly/field/value/array/_array.scss:8-9` (drag placeholder) | `background: #ccc` → `var(--mat-sys-surface-container-highest)`; `border: dotted 3px #999` → `dotted 3px var(--mat-sys-outline)` | drag placeholder now theme-aware |
| `dbx-form …/formly/field/selection/searchable/_searchable.scss:60` (`.dbx-chip-input-error`) | `var(--mdc-theme-error, #f44336)` → `var(--mat-sys-error)` | error text uses the M3 error role, not legacy MDC red |
| `dbx-web …/extension/table/_table.scss:48` (full-summary row) | `var(--mat-table-row-item-outline-color, var(--mat-app-outline, rgba(0,0,0,0.12)))` → `var(--mat-table-row-item-outline-color, var(--mat-sys-outline-variant))` | keeps the MDC override first; drops the dead `--mat-app-outline` + black-alpha literal |
| `dbx-form …/extension/calendar/_calendar.scss:78` (customized date-range pill) | `border-radius: 25px` → `var(--mat-sys-corner-full)` | identical full-pill render, now token-driven |
| `dbx-form …/forge/field/selection/sourceselect/_sourceselect.scss:9` (loading bar) | `border-radius: 999px` → `var(--mat-sys-corner-full)` | same |

---

## Batch 4 — Collapse `.dbx-chip` onto M3 tokens, drop the fake `mat-standard-chip` class (BREAKING)

`<dbx-chip>` (and the mapbox marker chip) used to emit a fake `mat-standard-chip` class purely so a
`.dbx-chip.mat-standard-chip` block could re-apply M2 MDC chip styling. The directive no longer emits
that class, and the layout rules are merged into the base `.dbx-chip`. The default corner radius
changes from a **full pill** to the M3 **corner-small**.

**Code changes**

| File | Change |
|---|---|
| `src/lib/layout/text/_text.scss` (chip block) | merged `.dbx-chip.mat-standard-chip` into `.dbx-chip` (`display:inline-flex`, `align-items:center`, `cursor:default`, `padding:7px 12px`, `min-height:32px`); radius → `var(--dbx-chip-container-shape, var(--mat-chip-container-shape-radius, var(--mat-sys-corner-small, 8px)))`; **removed** the `transition: box-shadow …` MDC residue and the `height: 1px` flex hack; deleted both `.mat-standard-chip` selectors; `@dbx-utility chip` annotation updated |
| `src/lib/layout/text/_text.scss` (`.dbx-chip-small-text`) | `font-size: 10px` → `var(--mat-sys-label-small-size, 10px)` |
| `src/lib/layout/text/text.chip.directive.ts:60` | host `class: 'dbx-chip mat-standard-chip'` → `'dbx-chip'` |
| `mapbox/src/lib/mapbox.marker.component.ts:115` | dropped `'mat-standard-chip'` from the marker chip class list |

**Visual delta**

- **Default chip radius: full pill → M3 corner-small (~8px).** The most visible change of the pass.
  Restore the pill per-app with `--dbx-chip-container-shape: var(--mat-sys-corner-full);`.
- `.dbx-chip-small-text` size 10px → `--mat-sys-label-small-size` (≈11px) — a hair larger, now
  theme-driven.
- Dropped the `box-shadow` transition (chips never elevated on hover, so no visible change) and the
  `height: 1px` hack. Centering is now handled by `min-height: 32px` + `align-items: center`
  (the standard self-sufficient approach). `.dbx-chip-small` keeps `2px 8px` / `min-height: 20px`;
  `.dbx-chip-block` keeps `border-radius: 0`. Sublabel chips and mapbox markers compose `.dbx-chip`
  and inherit the merged layout unchanged.
- `.dbx-chip.mat-standard-chip` selectors no longer exist and the class is no longer emitted — any
  downstream CSS targeting `.mat-standard-chip` on a dbx chip must retarget `.dbx-chip`
  (see [`VERSION_MIGRATION.md`](../../VERSION_MIGRATION.md)).

Chip paddings stay literal (`7px 12px` / `2px 8px`) — deliberate density; `--dbx-chip-container-shape`
is the existing override point so no new padding token is minted.

---

## Batch 5 — Off-scale typography / state cleanup + retained-literal documentation

Off-scale font sizes and a couple of state literals move onto M3 type-role and color tokens. One new
component-scoped token is minted for the prompt box inset.

| File:line | Before → After | Delta |
|---|---|---|
| `dbx-form …/formly/field/value/duration/_duration.scss:44` (`.dbx-duration-picker-label`) | `opacity: 0.7` → `color: var(--mat-sys-on-surface-variant)` | the uppercase label renders in the M3 on-surface-variant color instead of 70%-opacity inherited text (better contrast, theme-aware) |
| `dbx-form …/formly/field/value/duration/_duration.scss:49-50` (`.dbx-duration-picker-value`) | `font-size: 18px` → `var(--mat-sys-title-medium-size)` (≈16px); `font-weight: 500` → `var(--mat-sys-title-medium-weight)` | value text now uses the M3 title-medium role; ~2px smaller |
| `dbx-form …/formly/field/value/date/_date.scss` (`.dbx-datetime-timezone-button .mat-mdc-button`) | `font-size: 18px` → `var(--mat-sys-title-medium-size)` | same title-medium alignment |
| `dbx-form …/formly/field/value/phone/_phone.scss:16` (`button.country-selector`) | `opacity: 100` → `opacity: 1` | invalid CSS value (`100` clamps to `1`) corrected; **no render change**. Deletion was considered (line 12 sets `--ngxMatInputTel-selector-opacity: 100%`) but the conservative valid-value fix was chosen since screenshots were skipped — see KEEP-5 follow-up |
| `dbx-web …/interaction/prompt/_prompt.scss:21` (`.dbx-prompt-box`) | `padding: 40px` → `padding: var(--dbx-prompt-box-padding, 40px)` | identical default render; mints **one** new override point `--dbx-prompt-box-padding` (annotation updated; CSS-token manifest regenerated) |

---

## KEEP — retained literals and their removal criteria

These literals were reviewed and intentionally **not** changed in this pass. Each lists the criterion
that would later justify tokenizing or removing it.

- **KEEP-1 — progress-button icon nudges.** `spinner.button.component.scss:94,106` and
  `bar.button.component.scss:38` (small px nudges). These are icon-alignment offsets inside the button
  primitives, not M2 shape debt. _Remove when:_ the underlying `mat-button`/`mat-progress` icon metrics
  change such that the nudge is no longer needed, or the buttons are re-templated.
- **KEEP-2 — `opacity: 0.38` ×4 in `dbx-form …/form/_form.scss`** (`.dbx-forge-disabled` +
  `.dbx-forge-form-disabled`). 0.38 is the Material 3 disabled-state content opacity; M3 exposes no
  `--mat-sys-*` disabled-opacity token. Citing comment added in-file. _Remove when:_ Angular Material
  ships a system disabled-opacity token to reference instead.
- **KEEP-3 — `phone/_phone.scss:21` `padding: … 0 110px`.** Layout coupling to the third-party
  `ngx-mat-input-tel` country-selector width; the 110px clears the absolutely-positioned selector.
  _Remove when:_ the phone field is reworked off `ngx-mat-input-tel` or the selector width becomes a
  variable.
- **KEEP-4 — `date/_date.scss:12` `padding-top: 10px`.** Composite date-time field label clearance
  for the wrapper's notched-outline title. _Remove when:_ the composite field's outline/label layout is
  restructured.
- **KEEP-5 — off-scale insets (decision 4: no snapping).** `upload/_upload.scss:15` (`padding: 16px`)
  and `:43` (`padding: 32px 16px`), and `duration/_duration.scss:19` (`padding: 16px 8px`). These are
  deliberate off-scale component insets, left literal rather than snapped to the spacing scale or
  tokenized. _Remove when:_ a component-scoped padding token is genuinely needed as an app override
  point (mint `--dbx-…-padding` then), or the values are reconciled onto the spacing scale.
