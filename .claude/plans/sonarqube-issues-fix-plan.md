# SonarQube Issues — Triage & Fix Plan

**Project:** `dereekb_dbx-components`
**Snapshot:** 2026-04-27 (branch `develop`)
**Total open/confirmed issues:** **2,797**
  - HIGH/BLOCKER (new severity scale): **395**
  - The rest: MEDIUM/LOW/INFO

## Critical finding before fixing anything

The repo's `sonar-project.properties` defines `sonar.exclusions` (spec/generated files, setup, docker, tools) and a `multicriteria` ignore list (s6564, s6706, s6418, s2004, s3776). **None of those rules are actually being filtered.** Evidence:

- `typescript:S6564` is in the ignore list, yet 15 issues remain (in `packages/dbx-form/**`, `packages/zoho/src/**`).
- `typescript:S2004` is supposed to be ignored in `**/*.spec.ts`, yet 48 of 177 hits are in spec files.
- Spec files are also in `sonar.exclusions`, but 55+ spec.ts files are still flagged.
- There is no CI workflow running `sonar-scanner` (no `.github/workflows/*sonar*`, nothing in `.circleci/config.yml`). This means SonarCloud is using **Automatic Analysis**, which does **not** read `sonar-project.properties` — exclusions/ignores must be configured in the SonarCloud UI under *Project Settings → Analysis Scope / New Code*, or analysis must be switched to CI-based with the scanner CLI.

**This must be resolved first**, or any cleanup we do is partly throwing away effort the config was supposed to skip. Estimate: removing the spec/generated/tooling noise alone drops the total by several hundred issues for free.

---

## Top issues by rule (full set)

| Rule | Count | Severity | Description |
|------|-------|----------|-------------|
| typescript:S2004 | 177* | HIGH | Functions nested >4 levels deep |
| typescript:S3776 (+ js variant) | 140* | HIGH | Cognitive complexity too high |
| typescript:S1874 | 72 | MINOR | Deprecated API usage |
| typescript:S4325 | 68 | MINOR | Unnecessary type assertion |
| typescript:S7735 | 53 | MINOR | Unexpected negated condition |
| typescript:S6571 | 45 | MINOR | `unknown` overrides union members |
| shelldre:S7688 | 33 | MAJOR | Use `[[` instead of `[` in shell |
| typescript:S7721 | 29 | MAJOR | Move function to outer scope |
| typescript:S3735 | 21 | HIGH | `void` operator misuse |
| typescript:S4123 | 19 | HIGH | `await` on non-promise |
| typescript:S6564 | 15 | MAJOR | Redundant type alias (config-ignored — see above) |
| typescript:S7727 | 15 | HIGH | Function reference passed to iterator (parseInt-in-map class of bugs) |
| typescript:S2871 | 12 | HIGH | `.sort()` without comparator |
| typescript:S3358 | 10 | MAJOR | Nested ternary |
| typescript:S7773 | 10 | MINOR | `Number.isNaN` over `isNaN` |
| typescript:S1135 | 8 | INFO | TODO comments |
| shelldre:S1192 | 6 | MINOR | Repeated string literal in shell |
| typescript:S7778 | 6 | MINOR | Multiple consecutive `Array#push` |
| Web:S6819 | 5 | MAJOR | a11y — replace `role="group"` |
| typescript:S4624 | 5 | MAJOR | Nested template literals |
| typescript:S1854 | 4 | MAJOR | Useless variable assignment |
| typescript:S2094 | 4 | MINOR | Empty class |
| typescript:S6353 | 4 | MINOR | Use `\d` over `[0-9]` |
| typescript:S7746 | 4 | HIGH | `return Promise.resolve(x)` → `return x` |
| typescript:S4275 | 3 | HIGH | Getter/setter with same name |
| typescript:S4524 | 3 | HIGH | `default` clause first/last in switch |
| Other | ~30 rules | mixed | One-offs (regex complexity, naming, dup selector, etc.) |

*Counts marked `*` differ from the visible breakdown because the full search returned 500 of 2,797; the HIGH-severity slice (395) returned in full and contains the larger S2004/S3776 numbers.

## Top issues by area (HIGH/BLOCKER only)

| Area | HIGH/BLOCKER count |
|------|--------------------|
| `packages/firebase-server/model` | 60 |
| `packages/dbx-components-mcp/src` | 47 |
| `apps/demo-api/src` | 41 |
| `packages/zoho/cli` | 38 |
| `packages/util/src` | 27 |
| `packages/firebase/test` | 25 (should be excluded) |
| `packages/firebase/src` | 21 |
| `packages/dbx-form/src` | 15 |
| `packages/dbx-web/src` | 14 |
| `packages/dbx-firebase/src` | 10 |

---

## Phased plan

### Phase 0 — Configuration audit (do first, blocks everything else)

**Goal:** make the configured exclusions/ignores actually take effect, so we don't burn cycles fixing things SonarQube was meant to skip.

1. Verify which scan mode SonarCloud is using for `dereekb_dbx-components`.
2. If Automatic Analysis: either
   - port the exclusions and ignored rules from `sonar-project.properties` into the SonarCloud UI (*Administration → Analysis Scope* and *Quality Profiles → Deactivate rule for project*), **or**
   - switch to CI-based analysis (add `sonar-scanner` step to `.circleci/config.yml`) so `sonar-project.properties` is honored.
3. Re-scan and re-pull the issue list. The new baseline removes spec/generated/docker/tooling files plus s6564, s6706, s6418, s2004 (in specs), s3776 (in `dbx-components-mcp`).
4. **Expected impact:** ~400–700 issue reduction with no code changes.

### Phase 1 — Mechanical, low-risk wins (auto-fixable patterns)

Each item below can typically be applied with a codemod or careful Edit pass; review per file but the change is mechanical.

| # | Rule(s) | Approach | Est. count fixed |
|---|---------|----------|------------------|
| 1 | typescript:S4325 | Remove unnecessary `as X` assertions; rerun tsc | ~68 |
| 2 | typescript:S7773 | `isNaN(x)` → `Number.isNaN(x)` | ~10 |
| 3 | typescript:S6353 | `[0-9]` → `\d` in regexes | ~4 |
| 4 | typescript:S7759 | `.getTime()` → `Date.now()` (only when used as `Date.now()` equivalent) | ~4 |
| 5 | typescript:S7755 | `arr[arr.length - n]` → `arr.at(-n)` | ~2 |
| 6 | typescript:S7770 | `(x) => Boolean(x)` → `Boolean` | ~2 |
| 7 | typescript:S7781 | `String#replace(/g)` → `String#replaceAll` | ~2 |
| 8 | typescript:S7784 | `JSON.parse(JSON.stringify(x))` → `structuredClone(x)` | ~1 |
| 9 | typescript:S7762 | `parent.removeChild(child)` → `child.remove()` | ~1 |
| 10 | typescript:S7763 | `export const x = require(...)` re-export → `export ... from` | ~2 |
| 11 | typescript:S7778 | Coalesce consecutive `arr.push(a); arr.push(b);` → `arr.push(a, b)` | ~6 |
| 12 | typescript:S6606 | `x = x ?? y` → `x ??= y` | ~4 |
| 13 | typescript:S6650 | Drop redundant rename in destructuring | ~1 |
| 14 | typescript:S7744 | Drop empty `{}` literals | ~1 |
| 15 | typescript:S6644 | Simplify `cond ? a : a` defaults | ~1 |
| 16 | typescript:S2094 | Delete genuinely empty classes (verify they're not abstract markers) | ~4 |

**Subtotal:** ~120 quick fixes. Run lint + tests after each batch.

### Phase 2 — Targeted refactor passes

These are still mostly local but require judgment.

| # | Rule(s) | Approach | Est. count fixed |
|---|---------|----------|------------------|
| 1 | typescript:S7735 | Flip negated `if (!x) … else …` blocks | ~53 |
| 2 | typescript:S6571 | Strip `\| unknown` from union types (it absorbs the rest) | ~45 |
| 3 | typescript:S7721 | Hoist nested helper functions to module scope where they don't close over state | ~29 |
| 4 | typescript:S3358 | Extract nested ternaries to named consts/if statements | ~10 |
| 5 | typescript:S4624 | Extract inner template literals to consts | ~5 |
| 6 | typescript:S1854 | Delete dead assignments | ~4 |
| 7 | typescript:S1121 | Hoist assignment out of expression | ~4 |
| 8 | typescript:S7727 | Wrap `arr.map(parseInt)` etc. in arrow lambdas | ~15 |
| 9 | typescript:S2871 | Add comparator to `.sort()` calls | ~12 |
| 10 | typescript:S4123 | Audit `await` on non-promise; either remove `await` or fix return type | ~19 |
| 11 | typescript:S7746 | Replace `return Promise.resolve(x)` with `return x` in async functions | ~4 |
| 12 | typescript:S3735 | Drop `void` operator misuse (most are in spec files, will disappear with Phase 0) | ~21 |
| 13 | typescript:S1874 | Migrate off deprecated APIs — needs per-API mapping | ~72 |

**Subtotal:** ~290 issues. The `S1874` deprecation work is the largest and may overlap several with `DescriptionFieldConfig` etc. Worth checking whether the deprecation alternatives have already been written.

### Phase 3 — Complexity / structure refactors

These need careful design, file by file.

| # | Rule(s) | Approach | Est. count |
|---|---------|----------|-----------|
| 1 | typescript:S2004 (post-Phase-0) | Extract inner functions to module-level helpers; concentrate on top files: `sourceselect.field.component.ts`, `fixeddaterange.field.component.ts`, `mapbox.layout.component.ts`, `mapbox.rxjs.ts`, `calcom/oauth.service.ts` | ~80–130 (after spec exclusion) |
| 2 | typescript:S3776 / javascript:S3776 | Break long functions; extract decision tables. Top hot spots: `extract-firebase-models.mjs`, dbx-form forge field components, firebase-server model code | ~140 |
| 3 | shelldre:S7688 + S7677 + S7682 + S1192 | Update `exec-with-emulator.sh`, `start-merge-in-main.sh`, `packages/zoho/cli/test/test-cli.sh` to use `[[ … ]]`, redirect errors to stderr, add explicit returns, hoist string constants. Three files only. | ~46 |
| 4 | Web:S6819, S6845, MouseEventWithoutKeyboardEquivalent | a11y fixes in dbx-web templates: replace `role="group"`, drop stray `tabIndex`, add keyboard equivalents on chip-options. | ~8 |
| 5 | css:S4658, S4666, S4657 | Empty CSS blocks and duplicate selectors — small | ~8 |
| 6 | typescript:S5843 / javascript:S5843 | Two regexes need simplification (regex complexity 32 and 23) | 2 |

### Phase 4 — Long tail

Everything else (~30 rules with 1–4 hits each): handle case-by-case once the above is in. Track separately.

### Phase 5 — TODOs (`S1135`)

9 outstanding `TODO` comments. Either resolve or convert into linked GitHub issues so they stop showing up as Sonar issues.

---

## Suggested execution order

1. **Phase 0 (config)** — 1 sitting; revalidate counts.
2. **Phase 3 shell + a11y + CSS** — 3 small files for shell, handful of templates, gives wide rule coverage.
3. **Phase 1 mechanical wins** — single PR per rule (or a couple combined).
4. **Phase 2 deprecation migration (S1874)** — do this its own PR; start by listing the deprecated APIs and their replacements.
5. **Phase 2 remaining rules** — by rule.
6. **Phase 3 complexity** — per-file PRs in `packages/firebase-server/model`, `packages/dbx-components-mcp/src`, `packages/dbx-form/src`. Add tests if missing before refactoring complex functions.
7. **Phase 4** — long tail.

## Risk notes

- `typescript:S4123` (await-non-promise) and `typescript:S2871` (sort-no-comparator) are real bugs masquerading as code smells. Treat these as bug fixes, not just lint cleanup; review for behavioral changes.
- `typescript:S7727` includes the classic `[1,2,3].map(parseInt)` foot-gun; verify each call site is actually getting the intended result before "fixing".
- `typescript:S1874` (deprecated APIs) — make sure the replacement APIs are stable before bulk-migrating.
- Test files showing up in the report should disappear once Phase 0 is fixed; don't waste time refactoring them now.

## Tracking

Recommend creating one GitHub issue per phase (or per rule for Phase 1/2) so the cleanup is incremental and reviewable. Each PR should target a single rule/area and re-run the SonarQube scan.
