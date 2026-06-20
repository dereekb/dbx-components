# Audit dbx-form + dbx-firebase SCSS Against Component-Token Convention

> Queue item: `audit-dbx-form-dbx-firebase-scss-against-component-token-convention`

## Goal

Audit all SCSS in `packages/dbx-form` (**29** files / 1309 lines — corrected from 43; see Phase 0) and `packages/dbx-firebase` (15 files / 176 lines) against CT-1…CT-6 (component-token convention, ref 4). Deliver a categorized report; then — on user approval — apply the safe value-preserving subset and gate via `dbx-claude-commit`.

## Phases

### Phase 0 — Bootstrap ✓ COMPLETE
- [x] Read CT-1…CT-6 convention (ref 4)
- [x] Locate + read prior dbx-web workflow script for adaptation
- [x] Enumerate target SCSS files — **corrected**: dbx-form = **29** files (NOT 43; the prior inventory double-counted by labeling `forge/` paths as a non-existent `formly/` dir — there is no `formly/`, all field styling lives under `forge/`). dbx-firebase = 15 files.
- [x] Ground-truth token surface (grep, this session):
  - **dbx-form: 0 `--dbx-*` declarations** (pure-consume), 18 `var(--dbx-)` usages, 37 `var(--mat-sys-)`, **0 naked hex colors** anywhere, 87 px/rem literal lines (dominant 4/8/16px are **off-scale** → KEEP; many are `$scss-var` decls).
  - **dbx-firebase: 0 / 0 / 0** token surface confirmed; 11 px/rem lines (mostly `$scss-var` decls).
  - **Scope consequence:** categories **A (CT-1) + C (CT-2) are EMPTY BY CONSTRUCTION** (no declarations); **B (CT-3 color) is clean** (no hex to break). Only **D (CT-5 naked spacing)** is live, plus E/F. Spacing scale is exactly **2/6/12/18/24px** → 4/8/16px have no global token.

### Phase 1 — Lean Tiered Workflow (Analyze → Verify → Synth) — LAUNCHED
Run ID `wf_32f992b9-c38` (script `audit-dbx-form-firebase-scss-tokens`). Leaner than the original 14-agent draft (per the budget guard) and re-pathed to the real `forge/` tree. **12 analyze units:**
- **5 deep** (1 file each): `extension/calendar/_calendar.scss` (150, KEEP-biased angular-calendar) · `forge/field/wrapper/_wrapper.scss` (132) · `forge/field/value/date/_date.scss` (122) · `forge/preset/_preset.scss` (119) · `forge/field/selection/searchable/_searchable.scss` (103)
- **4 medium batches**: texteditor+form · array+duration · shared+pickable · phone+sourceselect+mapbox
- **2 light infra batches**: form-infra-content (`_config`,`_extension`,`_field`,`_selection`,`_list`,`_index`) · form-infra-aggregators (9 tiny mixins/aggregators)
- **1 light batch (dbx-firebase)**: all 15 files — confirmatory sweep

**Adversarial verify:** every actionable finding → independent skeptic agent (default REJECT; off-scale-spacing + `$scss-var`-decl + size-literal-fallback guards baked into the prompt). **Synthesize:** one combined per-package report.

### Phase 2 — Report Delivery
Deliver report to user. Sections per package:
- A: CT-1 pass-throughs (wrappers around Material tokens nobody overrides)
- B: CT-3 dark-mode-broken color fallbacks (literal-only color fallbacks)
- C: CT-2 naming shape issues
- D: CT-5 naked literals → token/global scale candidates
- E: Simplify/deduplicate opportunities
- F: KEEP with reason (legit Material overrides, 3rd-party tokens, etc.)

### Phase 3 — Apply (on user approval)
- Apply safe value-preserving subset (CT-5 naked literals → global scale, same lens as dbx-web pass)
- Validate: `npx sass packages/dbx-form/src/_index.scss /tmp/out-form.css --load-path=packages --load-path=node_modules --quiet-deps --no-source-map`
- Validate: `npx sass packages/dbx-firebase/src/_index.scss /tmp/out-firebase.css --load-path=packages --load-path=node_modules --quiet-deps --no-source-map`
- Gate: `dbx-claude-commit precheckOnly: true`
- Commit on user approval

## Status

- [x] Plan written + linked
- [x] Phase 0 bootstrap complete
- [x] Workflow launched (`wf_32f992b9-c38`)
- [x] Report delivered — note: `cloud-sync/notes/dbx-form-firebase-scss-audit/dbx-form-firebase-scss-component-token-audit.md`
- [ ] User approved edits
- [ ] Edits applied + validated
- [ ] Committed

### Result (workflow `wf_32f992b9-c38`, 14 agents, ~690k tokens)
**Token hygiene GOOD — 1 confirmed actionable finding, 0 rejected.**
- dbx-form: A=0, B=0, C=0, **D=1**, E=2 (deferred non-CT), F=many KEEP.
- dbx-firebase: A=0, B=0, C=0, D=0, E=1 (deferred), F=many KEEP.
- **The one change (value-preserving, adversarially confirmed):** `forge/style/_shared.scss:13` `padding: 6px 0;` → `padding: var(--dbx-padding-2) 0;`
- Deferred (out of scope, non-CT lint): dead `@use '@angular/material' as mat` in both packages' `src/_index.scss`.
- No CT-6 `generate-css-tokens` regen needed (0 tokens added/renamed/removed).

## Reference Links
- Convention: `dbx-claude ref 4` (component-token)
- Prior workflow script: `~/.claude/projects/-Users-dereekb-development-git-dbcomponents/96e47877-19cb-43c4-a363-92be51318e33/workflows/scripts/audit-dbx-web-scss-tokens-wf_7913594a-91e.js`
- dbx-web audit report: `~/.claude/cloud-sync/notes/dbx-web-scss-audit/dbx-web-scss-component-token-audit.md`
