# SonarCloud — PR 51 (refactor/eslint-v10) remaining issues

Pulled via `mcp__sonarqube__search_sonar_issues_in_projects` (OPEN + CONFIRMED) on 2026-05-18.

- Project: `dereekb_dbx-components`
- Raw total returned: **113**
- Filter applied: drop `typescript:S3776` (cognitive complexity) UNLESS file is under `packages/util/eslint/`
- Remaining after filter: **59** across **37** files

> Note: 25 `typescript:S6564` ("redundant type alias") issues come back even though `sonar-project.properties` already declares a `**/*.ts` ignore for that rule. SonarCloud PR analysis appears to ignore the multicriteria filter for new code. Leaving them in the list — most live in `packages/util/eslint/`.

---

## Issues by file

### `eslint.config.mjs` (1)
- L109 — `javascript:S1135` Complete the task associated to this "TODO" comment.

### `packages/dbx-cli/lint-cache/src/build-many.ts` (1)
- L191 — `typescript:S7780` `String.raw` should be used to avoid escaping `\`.

### `packages/dbx-cli/lint-cache/src/format.ts` (1)
- L38 — `typescript:S7778` Do not call `Array#push()` multiple times.

### `packages/dbx-cli/lint-cache/src/query.ts` (1)
- L84 — `typescript:S7780` `String.raw` should be used to avoid escaping `\`.

### `packages/dbx-cli/src/lib/manifest/build-model-info-command.ts` (1)
- L97 — `typescript:S6660` 'If' statement should not be the only statement in 'else' block.

### `packages/dbx-cli/src/lib/util/pagination.ts` (1)
- L97 — `typescript:S2589` This always evaluates to truthy. Consider refactoring this code.

### `packages/dbx-core/src/lib/injection/injection.context.directive.ts` (1)
- L151 — `typescript:S6551` 'error' will use Object's default stringification format ('[object Object]') when stringified.

### `packages/dbx-firebase/src/lib/model/modules/store/store.document.ts` (1)
- L300 — `typescript:S7735` Unexpected negated condition.

### `packages/dbx-web/src/lib/interaction/detach/detach.service.ts` (1)
- L153 — `typescript:S4325` This assertion is unnecessary since the receiver accepts the original type of the expression.

### `packages/trello/src/lib/trello/trello.api.board.type.ts` (1)
- L37 — `typescript:S6564` Remove this redundant type alias and replace its occurrences with "string".

### `packages/trello/src/lib/trello/trello.api.card.ts` (1)
- L100 — `typescript:S6564` Remove this redundant type alias and replace its occurrences with "string".

### `packages/util/eslint/src/lib/dbx-tag-families.ts` (3)
- L15 — `typescript:S6564` Remove this redundant type alias and replace its occurrences with "any".
- L161 — `typescript:S3776` Cognitive Complexity 36 → 15.
- L251 — `typescript:S3776` Cognitive Complexity 18 → 15.

### `packages/util/eslint/src/lib/jsdoc-parser.ts` (1)
- L147 — `typescript:S3776` Cognitive Complexity 49 → 15.

### `packages/util/eslint/src/lib/no-inline-type-import.rule.ts` (1)
- L1 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/no-sister-re-export.rule.ts` (1)
- L1 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/prefer-canonical-jsdoc.rule.ts` (7)
- L5 — `typescript:S6564` Redundant type alias → "any".
- L390 — `typescript:S3776` Cognitive Complexity 20 → 15.
- L595 — `typescript:S3776` Cognitive Complexity 20 → 15.
- L630 — `typescript:S3776` Cognitive Complexity 19 → 15.
- L914 — `typescript:S3776` Cognitive Complexity 45 → 15.
- L984 — `typescript:S3776` Cognitive Complexity 52 → 15.
- L1102 — `typescript:S3776` Cognitive Complexity 19 → 15.

### `packages/util/eslint/src/lib/prefer-config-object.rule.ts` (1)
- L1 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/prefer-maybe-type.rule.ts` (2)
- L2 — `typescript:S6564` Redundant type alias → "any".
- L140 — `typescript:S3776` Cognitive Complexity 21 → 15.

### `packages/util/eslint/src/lib/require-constant-naming.rule.ts` (1)
- L1 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-dbx-action-companion-tags.rule.ts` (2)
- L6 — `typescript:S6564` Redundant type alias → "any".
- L103 — `typescript:S3776` Cognitive Complexity 40 → 15.

### `packages/util/eslint/src/lib/require-dbx-auth-companion-tags.rule.ts` (2)
- L5 — `typescript:S6564` Redundant type alias → "any".
- L91 — `typescript:S3776` Cognitive Complexity 16 → 15.

### `packages/util/eslint/src/lib/require-dbx-docs-ui-example-companion-tags.rule.ts` (1)
- L5 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-dbx-filter-companion-tags.rule.ts` (1)
- L5 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-dbx-form-field-companion-tags.rule.ts` (2)
- L6 — `typescript:S6564` Redundant type alias → "any".
- L145 — `typescript:S3776` Cognitive Complexity 68 → 15.

### `packages/util/eslint/src/lib/require-dbx-model-companion-tags.rule.ts` (2)
- L6 — `typescript:S6564` Redundant type alias → "any".
- L121 — `typescript:S3776` Cognitive Complexity 66 → 15.

### `packages/util/eslint/src/lib/require-dbx-model-firebase-index-companion-tags.rule.ts` (2)
- L6 — `typescript:S6564` Redundant type alias → "any".
- L108 — `typescript:S3776` Cognitive Complexity 16 → 15.

### `packages/util/eslint/src/lib/require-dbx-model-snapshot-field-companion-tags.rule.ts` (1)
- L6 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-dbx-pipe-companion-tags.rule.ts` (1)
- L5 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-dbx-rule-companion-tags.rule.ts` (2)
- L5 — `typescript:S6564` Redundant type alias → "any".
- L81 — `typescript:S3776` Cognitive Complexity 31 → 15.

### `packages/util/eslint/src/lib/require-dbx-util-companion-tags.rule.ts` (2)
- L6 — `typescript:S6564` Redundant type alias → "any".
- L130 — `typescript:S3776` Cognitive Complexity 43 → 15.

### `packages/util/eslint/src/lib/require-dbx-web-companion-tags.rule.ts` (1)
- L5 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-deprecated-alias-placement.rule.ts` (5)
- L1 — `typescript:S6564` Redundant type alias → "any".
- L164 — `typescript:S7735` Unexpected negated condition.
- L273 — `typescript:S3776` Cognitive Complexity 39 → 15.
- L341 — `typescript:S7735` Unexpected negated condition.
- L357 — `typescript:S7735` Unexpected negated condition.

### `packages/util/eslint/src/lib/require-exported-jsdoc-example.rule.ts` (1)
- L1 — `typescript:S6564` Redundant type alias → "any".

### `packages/util/eslint/src/lib/require-no-side-effects.rule.ts` (1)
- L143 — `typescript:S3776` Cognitive Complexity 16 → 15.

### `packages/util/eslint/src/lib/require-readonly-config-params.rule.ts` (2)
- L1 — `typescript:S6564` Redundant type alias → "any".
- L138 — `typescript:S3776` Cognitive Complexity 24 → 15.

### `packages/util/eslint/src/lib/require-single-return.rule.ts` (2)
- L1 — `typescript:S6564` Redundant type alias → "any".
- L65 — `typescript:S3776` Cognitive Complexity 29 → 15.

### `packages/zoho/nestjs/src/lib/accounts/accounts.service.ts` (1)
- L189 — `typescript:S4325` This assertion is unnecessary since it does not change the type of the expression.

---

## Roll-up by rule (after filter)

| Rule | Count | Notes |
| --- | ---: | --- |
| `typescript:S3776` (Cognitive Complexity) | 21 | Kept only inside `packages/util/eslint/` per request |
| `typescript:S6564` (Redundant type alias) | 25 | Already ignored project-wide via `sonar-project.properties`, but SonarCloud PR view re-flags them |
| `typescript:S7735` (Unexpected negated condition) | 4 | 3 in `require-deprecated-alias-placement.rule.ts`, 1 in `store.document.ts` |
| `typescript:S7780` (`String.raw` should be used) | 2 | `lint-cache/build-many.ts`, `lint-cache/query.ts` |
| `typescript:S4325` (Unnecessary assertion) | 2 | `detach.service.ts`, `accounts.service.ts` |
| `typescript:S1135` (TODO) | 1 | Root `eslint.config.mjs` L109 |
| `typescript:S2589` (Always truthy) | 1 | `dbx-cli/pagination.ts` L97 |
| `typescript:S6551` (Object stringification) | 1 | `dbx-core/injection.context.directive.ts` L151 |
| `typescript:S6660` (`else { if (...) }` chain) | 1 | `dbx-cli/build-model-info-command.ts` L97 |
| `typescript:S7778` (Multiple `Array#push`) | 1 | `lint-cache/format.ts` L38 |

Files dropped by filter: 54 `typescript:S3776` issues outside `packages/util/eslint/` (mostly `dbx-components-mcp` tools — already covered by the existing `s3776` multicriteria exclusion in `sonar-project.properties`).

Raw data: `.claude/tmp/pr51-sonar-issues.json` (full) and `.claude/tmp/pr51-filtered-issues.json` (filtered).
