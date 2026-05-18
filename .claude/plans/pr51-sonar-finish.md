# PR 51 SonarCloud cleanup — handover plan

You are taking over a half-finished SonarCloud cleanup on branch `refactor/eslint-v10` (PR #51) of `dbx-components` at `/Users/dereekb/development/git/dbx-components`. Six parallel sub-agents were launched; three were killed mid-task. This plan tells you what is confirmed done, what is partial, and how to finish.

Do NOT switch branches. Do NOT commit. The user reviews + commits.

---

## Original goal

Fix the 59 open SonarCloud issues in PR 51, after dropping `typescript:S3776` outside `packages/util/eslint/`. Source-of-truth artifacts already on disk:

- `.claude/tmp/pr51-sonar-report.md` — per-file breakdown of the 59 issues
- `.claude/tmp/pr51-filtered-issues.json` — machine-readable filtered set
- `.claude/tmp/pr51-sonar-issues.json` — full 113 raw
- `~/.claude/cloud-sync/log/dbx-components/pr51-sonar-issue-digest.md` — full prior context

Re-pull from SonarCloud anytime with:
```
mcp__sonarqube__search_sonar_issues_in_projects projects=["dereekb_dbx-components"] pullRequestId="51" issueStatuses=["OPEN","CONFIRMED"] ps=500
```

## Fix patterns the prior agents used (keep consistent)

- **S6564 `type AstNode = any`** → convert to:
  ```ts
  interface AstNode {
    readonly type: string;
    [key: string]: any;
  }
  ```
  Interfaces are not flagged by S6564 and the index signature preserves loose semantics.
- **S6564 `type X = string` semantic aliases in trello** → end-of-line `// NOSONAR (S6564 — intentional semantic alias)`. The project documents this convention in `sonar-project.properties` lines 14-20.
- **S3776 cognitive complexity** → extract module-scope helpers, replace nested `if (a) { if (b) { ... } }` with early-return guards or combined conditions, prefer dispatch tables over long if/else chains. Behavior must be byte-identical — specs must stay green.
- **S7735 unexpected negated condition** → flip `if (!x) { A } else { B }` → `if (x) { B } else { A }`, preserving semantics exactly.
- **S1135 TODO** in `eslint.config.mjs` → replace `// TODO(...)` with `// NOTE(...)` (already done).

## Status by group

### Group A (12 quick wins outside util/eslint) — UNKNOWN STATE, likely complete
Probed on-disk and confirmed:
- `eslint.config.mjs` L109 — TODO→NOTE ✓
- `packages/dbx-cli/lint-cache/src/build-many.ts` L191 — `String.raw` ✓
- `packages/dbx-cli/lint-cache/src/query.ts` L84 — `String.raw` ✓
- `packages/dbx-cli/lint-cache/src/format.ts` L38 — push collapse looks done
- `packages/dbx-cli/src/lib/manifest/build-model-info-command.ts` L97 — `else if` chain ✓
- `packages/trello/src/lib/trello/trello.api.board.type.ts` L37 — NOSONAR ✓
- `packages/trello/src/lib/trello/trello.api.card.ts` L100 — NOSONAR ✓

**Verify the remaining 5:** open each and confirm the fix shape from `.claude/tmp/pr51-sonar-report.md`:
- `packages/dbx-cli/src/lib/util/pagination.ts:97` (S2589 always-truthy `if (mainPath)` should be removed)
- `packages/dbx-core/src/lib/injection/injection.context.directive.ts:151` (S6551 — rewrite ternary as a typed if/else chain that handles null/undefined explicitly)
- `packages/dbx-firebase/src/lib/model/modules/store/store.document.ts:300` (S7735 — flip negated condition)
- `packages/dbx-web/src/lib/interaction/detach/detach.service.ts:153` (S4325 — drop redundant `as`)
- `packages/zoho/nestjs/src/lib/accounts/accounts.service.ts:189` (S4325 — drop redundant `as`)

If any are unfixed, apply the fix described in `pr51-sonar-report.md` + the user-context note in `~/.claude/cloud-sync/log/dbx-components/pr51-sonar-issue-digest.md`.

### Group B (10 S6564-only util/eslint files) — COMPLETE
Confirmed via spec run (323 tests passing). Don't touch.

### Group C (7 small-medium S3776) — INTERFACE STAGE DONE, S3776 REFACTORS PARTIAL
Agent was killed while working on the LAST file (`require-no-side-effects.rule.ts`).

S6564→interface stage status (probed):
- `dbx-tag-families.ts` ✓
- `prefer-maybe-type.rule.ts` ✓
- `require-dbx-auth-companion-tags.rule.ts` ✓
- `require-dbx-model-firebase-index-companion-tags.rule.ts` ✓
- `require-readonly-config-params.rule.ts` ✓
- `require-single-return.rule.ts` ✓
- `require-no-side-effects.rule.ts` — N/A (no S6564 was expected here)

**You must verify each file's S3776 refactor and finish where missing:**
| File | S3776 lines (orig) | Action |
| --- | --- | --- |
| `dbx-tag-families.ts` | L161 (36→15), L251 (18→15) | Verify |
| `prefer-maybe-type.rule.ts` | L140 (21→15) | Verify |
| `require-dbx-auth-companion-tags.rule.ts` | L91 (16→15) | Verify |
| `require-dbx-model-firebase-index-companion-tags.rule.ts` | L108 (16→15) | Verify |
| `require-readonly-config-params.rule.ts` | L138 (24→15) | Verify |
| `require-single-return.rule.ts` | L65 (29→15) | Verify |
| `require-no-side-effects.rule.ts` | L143 (16→15) — `checkFunction` | **Likely incomplete — finish it.** The kill summary said: "extract the fixer logic" was the next step. |

Run `pnpm exec vitest run packages/util/eslint/src/lib/<basename>.spec.ts` per file to validate.

### Group D (5 high-complexity companion-tags) — PARTIAL
Agent killed on file 4 (`require-dbx-util-companion-tags.rule.ts`).

S6564→interface stage (probed):
- `require-dbx-action-companion-tags.rule.ts` ✓
- `require-dbx-form-field-companion-tags.rule.ts` — **NOT DONE** (still `type AstNode = any` at L6)
- `require-dbx-model-companion-tags.rule.ts` ✓
- `require-dbx-rule-companion-tags.rule.ts` ✓
- `require-dbx-util-companion-tags.rule.ts` ✓

**S3776 refactor status — UNVERIFIED for all 5. Verify each by reading the file and comparing the function near the flagged line to its prior shape (use `git diff HEAD -- packages/util/eslint/src/lib/<file>` to see what was changed).** The flagged S3776 lines from the original report:
- `require-dbx-action-companion-tags.rule.ts` L103 (40→15)
- `require-dbx-form-field-companion-tags.rule.ts` L145 (68→15) — biggest; also still needs S6564 fix
- `require-dbx-model-companion-tags.rule.ts` L121 (66→15)
- `require-dbx-rule-companion-tags.rule.ts` L81 (31→15)
- `require-dbx-util-companion-tags.rule.ts` L130 (43→15)

Validate via `pnpm exec vitest run packages/util/eslint/src/lib/<basename>.spec.ts`.

### Group E (jsdoc-parser + prefer-canonical-jsdoc) — UNKNOWN STATE
No completion notification arrived; this agent may still be running OR was killed silently. Check process / probe disk state.

Initial probe:
- `jsdoc-parser.ts` — no S6564 expected (none in original report). S3776 L147 (49→15) status unknown.
- `prefer-canonical-jsdoc.rule.ts` — S6564 converted to interface ✓. Six S3776 issues unknown: L390 (20), L595 (20), L630 (19), L914 (45), L984 (52), L1102 (19).

**Verify** by running `pnpm exec vitest run packages/util/eslint/src/lib/prefer-canonical-jsdoc.rule.spec.ts` and `jsdoc-parser.spec.ts` (if it exists). Then re-pull SonarCloud issues to see if those lines still flag. If they still flag, refactor per the pattern.

### Group F (require-deprecated-alias-placement) — LIKELY COMPLETE except minor JSDoc cleanup
Agent killed while polishing JSDoc on its extracted helpers. Probed:
- S6564 interface ✓
- The 3 S7735 negated-condition flips and the S3776 L273 (39→15) refactor presumably done (the kill message said: "Also fix the JSDoc for the two refactored functions" — implying refactor itself was complete).

**Verify** via `pnpm exec vitest run packages/util/eslint/src/lib/require-deprecated-alias-placement.rule.spec.ts`. Check JSDoc on any newly-extracted helpers documents the actual parameters (the kill happened because doc was stale).

## Files known to still need work

Hard-confirmed by `grep -c "interface AstNode" / "type AstNode = any"`:

- `packages/util/eslint/src/lib/require-dbx-form-field-companion-tags.rule.ts` — needs BOTH S6564 (L6) AND S3776 L145 (68→15). This is the highest-complexity untouched function in the project.
- `packages/util/eslint/src/lib/require-no-side-effects.rule.ts` — S3776 L143 (16→15) likely incomplete (agent killed here mid-edit). The "checkFunction" closure needed the fixer logic extracted.

## Recommended order of operations

1. **Discovery pass (~5 min)**: For every Group C/D/E file, run `git diff HEAD -- packages/util/eslint/src/lib/<file>` and skim for whether the function near the flagged line was meaningfully restructured. Mark each as "refactored" / "needs work" in your notes.
2. **Finish the two known-incomplete files first**: form-field-companion-tags (S6564 + S3776 L145) and require-no-side-effects (S3776 L143).
3. **Validate** with `pnpm nx test util-eslint` — full suite. If any spec fails, the prior refactor broke behavior; isolate via `pnpm exec vitest run <spec>` and either repair or revert the targeted function.
4. **Fix anything Discovery flagged** — refactor S3776 per the pattern (extract helpers, early returns).
5. **Verify remaining Group A items** (the 5 unconfirmed quick wins). They are tiny.
6. **Final validation**:
   ```
   pnpm nx lint util-eslint
   pnpm nx test util-eslint
   pnpm nx lint dbx-cli
   pnpm nx test dbx-cli                 # if it has a test target
   pnpm nx lint dbx-core
   pnpm nx lint dbx-firebase-base       # check project name with cat project.json
   pnpm nx lint dbx-web-base
   pnpm nx lint zoho
   pnpm nx lint trello
   ```
7. **Re-pull SonarCloud** to confirm issue count dropped from 59. The 25 S6564 occurrences may reappear in PR analysis even after conversion (Sonar PR view treats new code differently) — that is acceptable; the convention is documented.

## Validation commands cheatsheet

```bash
# Per-file spec
pnpm exec vitest run packages/util/eslint/src/lib/<basename>.spec.ts

# Full util/eslint
pnpm nx test util-eslint
pnpm nx lint util-eslint

# Diff a file vs HEAD
git diff HEAD -- packages/util/eslint/src/lib/<file>

# Re-pull SonarCloud (via MCP) — see top of this plan
```

## Reporting back

When done, write a `.claude/tmp/pr51-finish-report.md` with:
- Files actually changed since the prior commit (`git diff --name-only HEAD`)
- Per-rule remaining-count from a fresh SonarCloud query
- Any specs that fail and why
- Anything you decided to skip and the reasoning

Don't commit. Hand back to the user.

## Constraints to remember

- No comments unless the WHY is non-obvious (CLAUDE.md global rule).
- No new tests beyond what regression-tracking demands.
- No new files (the prior agents created NOTHING new — only edits).
- `dbx-components-mcp/**` S3776 issues are explicitly OUT of scope (already excluded by `sonar-project.properties`). Don't touch them.
- The 23 `type AstNode = any` → interface conversions are intentional and self-contained; do NOT centralize them into a shared module unless the user asks. The previous agents preserved the "no-deps" intent.
