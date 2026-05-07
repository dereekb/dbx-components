# Lint Fix — JSDoc Cleanup Plan

**Date:** 2026-05-06
**Scope:** All `jsdoc/require-param`, `jsdoc/require-returns`, `jsdoc/require-jsdoc` warnings across the workspace.
**Total:** 457 warnings across 75 files.

## Out of scope

- `@typescript-eslint/no-deprecated` (132 warnings) — calendar/forge/formly migrations in flight; addressed by migration work, not this pass.
- `sonarjs/cognitive-complexity` (10 warnings) — needs structural refactor with judgment; deferred.

## Already fixed in this session

- `import/export` error in `packages/dbx-form/src/lib/forge/index.ts` — converted `export *` of module-augmentation file into a side-effect `import`.
- `sonarjs/no-identical-functions` (6 warnings) — extracted `makeAwaitBothGate(done)` helper in `packages/firebase/test/src/lib/common/firestore/test.driver.query.ts`; refactored 8 `tryComplete` closures.
- `@typescript-eslint/max-params` (6 warnings):
  - Refactored `resolve` in `packages/dbx-cli/src/lib/auth/auth.command.factory.ts` to options object.
  - Refactored `waitFor` in `packages/dbx-form/src/lib/forge/field/value/date/datetime.field.component.spec.ts` to options object.
  - Refactored `performFullOAuthFlow` in `packages/firebase-server/test/src/lib/oidc/oidc.test.flow.ts` to options object (added `PerformFullOAuthFlowInput` interface).
  - Refactored `callAuthBlockingFunction` in `packages/firebase-server/test/src/lib/firebase/firebase.admin.auth.ts` to options object; updated single caller in `apps/demo-api/src/test/fixture.ts`.
  - Inline-disabled rule on deprecated `callEventCloudFunction` (gen 1, slated for removal).
  - Inline-disabled rule on `makeInstance` interface callback (used widely by downstream test fixtures).

## Conventions for JSDoc work

Follow `dbx__note__typescript-jsdocs`. **Do not write empty stubs.**

- Each `@param` must include a brief description of what the parameter is/does (not just the name retyped).
- Each `@returns` must describe what is returned, including failure modes if relevant.
- For destructured object inputs (e.g. `function foo(input: { a; b; c })`), document `@param input` once with a single sentence describing the bag, then add `@param input.a`, `@param input.b`, etc. with descriptions per ESLint's `jsdoc/require-param` expectations.
- Multi-line block format `/** ... */`. No single-line `/** comment */`.
- Top-level exported functions/classes/interfaces should also include a 1–3 sentence description above the `@param`/`@returns` block.
- Use the existing surrounding code as the source of truth — do not invent behavior. If a function's purpose is unclear from its body and call sites, mark it for follow-up rather than guessing.

## Verification

After each bucket:
```bash
pnpm nx lint <project> 2>&1 | grep "jsdoc/require"; true
```

After all buckets complete, run a workspace-wide build to catch downstream breakage from any signature/JSDoc-driven changes:
```bash
pnpm nx run-many --target=build 2>&1; true
```

## Worker buckets

Each bucket below is sized to ~60–100 warnings. Workers operate in parallel.

### Bucket 1 — zoho-nestjs (~92 warnings)

- `packages/zoho/nestjs/src/lib/desk/desk.api.ts` (88)
- `packages/zoho/nestjs/src/lib/accounts/accounts.service.ts` (4)

Notes: `desk.api.ts` is a thin REST client wrapper for Zoho Desk. Each method maps to a documented Zoho endpoint — describe what the call does (list/get/create/update tickets/contacts/etc.) and what the response shape represents. `accounts.service.ts` is the analytics-account NestJS service.

### Bucket 2 — zoho-cli (~74 warnings)

- `packages/zoho/cli/src/lib/config/cli.config.ts` (32)
- `packages/zoho/cli/src/lib/util/args.ts` (12)
- `packages/zoho/cli/src/lib/middleware/auth.middleware.ts` (10)
- `packages/zoho/cli/src/lib/context/cli.context.ts` (6)
- `packages/zoho/cli/src/lib/util/output.ts` (6)
- `packages/zoho/cli/src/lib/commands/auth.command.ts` (4)
- `packages/zoho/cli/src/lib/config/token.cache.ts` (4)

Notes: This is the Zoho CLI tool. `cli.config.ts` is config loading/merging/persisting. `args.ts` is yargs-builder helpers. `auth.middleware.ts` is auth-required command guards. `output.ts` is JSON-output formatting.

### Bucket 3 — dbx-cli (~74 warnings)

- `packages/dbx-cli/src/lib/config/cli.config.ts` (12)
- `packages/dbx-cli/src/lib/util/output.ts` (11)
- `packages/dbx-cli/src/lib/auth/oidc.client.ts` (7)
- `packages/dbx-cli/src/lib/auth/oidc.flow.ts` (7)
- `packages/dbx-cli/src/lib/config/env.ts` (6)
- `packages/dbx-cli/src/lib/config/token.cache.ts` (6)
- `packages/dbx-cli/src/lib/util/args.ts` (6)
- `packages/dbx-cli/src/lib/util/pagination.ts` (4)
- `packages/dbx-cli/src/lib/doctor/doctor.command.factory.ts` (3)
- `packages/dbx-cli/src/lib/runner/run.ts` (3)
- `packages/dbx-cli/src/lib/api/call-model.client.ts` (2)
- `packages/dbx-cli/src/lib/api/call-model.command.factory.ts` (2)
- `packages/dbx-cli/src/lib/config/paths.ts` (2)
- `packages/dbx-cli/src/lib/middleware/auth.middleware.ts` (2)
- `packages/dbx-cli/src/lib/middleware/output.middleware.ts` (2)
- `packages/dbx-cli/src/lib/output/output.command.factory.ts` (2)
- `packages/dbx-cli/src/lib/util/context.slot.ts` (2)
- `packages/dbx-cli/src/lib/util/handler.ts` (2)
- `packages/dbx-cli/src/lib/util/interactive.ts` (2)
- `packages/dbx-cli/src/lib/auth/auth.command.factory.ts` (1)
- `packages/dbx-cli/src/lib/context/cli.context.ts` (1)
- `packages/dbx-cli/src/lib/env/env.command.factory.ts` (1)

Notes: This is the dbx-cli scaffolding for downstream apps' OIDC-authenticated CLIs. `cli.config.ts` is config persistence. `oidc.client.ts`/`oidc.flow.ts` are OIDC PKCE flow with loopback server. `output.ts` is structured output (JSON/text).

### Bucket 4 — firebase-server (~83 warnings)

- `packages/firebase-server/test/src/lib/firebase/firebase.admin.auth.ts` (16) — note: function/method already partially documented in this session; only newly-added `callAuthBlockingFunction` input bag and other untouched APIs need JSDoc
- `packages/firebase-server/test/src/lib/oidc/oidc.test.flow.ts` (15) — note: `performFullOAuthFlow` interface added in this session; complete its JSDoc
- `packages/firebase-server/test/src/lib/firebase/firebase.function.ts` (14)
- `packages/firebase-server/test/src/lib/oidc/oidc.test.fixture.ts` (12)
- `packages/firebase-server/oidc/src/lib/controller/oidc.provider.controller.ts` (8)
- `packages/firebase-server/test/src/lib/firebase/firebase.ts` (6)
- `packages/firebase-server/test/src/lib/firebase/firebase.admin.nest.function.ts` (3)
- `packages/firebase-server/test/src/lib/firebase/firebase.admin.collection.ts` (2)
- `packages/firebase-server/test/src/lib/firebase/firebase.admin.nest.function.callable.context.ts` (2)
- `packages/firebase-server/test/src/lib/firebase/firebase.admin.nest.function.cloud.context.ts` (2)
- `packages/firebase-server/test/src/lib/firebase/firebase.admin.nest.ts` (2)
- `packages/firebase-server/test/src/lib/firebase/firebase.admin.function.ts` (1)
- `packages/firebase-server/test/src/lib/firebase/firebase.test.ts` (1)
- `packages/firebase-server/test/src/lib/firestore/firestore.ts` (1)
- `packages/firebase-server/test/src/lib/storage/storage.ts` (1)

Notes: Test-context fixture machinery for firebase-server. `oidc.provider.controller.ts` is the OIDC interaction controller (login/consent endpoints).

### Bucket 5 — firebase-test (~58 warnings)

- `packages/firebase/test/src/lib/common/mock/mock.item.ts` (34)
- `packages/firebase/test/src/lib/client/firebase.ts` (10)
- `packages/firebase/test/src/lib/common/mock/mock.item.query.ts` (5)
- `packages/firebase/test/src/lib/common/mock/mock.item.collection.fixture.ts` (3)
- `packages/firebase/test/src/lib/common/mock/mock.item.service.ts` (2)
- `packages/firebase/test/src/lib/common/mock/mock.item.storage.fixture.ts` (2)
- `packages/firebase/test/src/lib/common/firestore/test.driver.query.ts` (2)
- `packages/firebase/test/src/lib/common/storage/storage.ts` (2)
- `packages/firebase/test/src/lib/common/firestore/firestore.ts` (1)

Notes: Mock model/test driver fixtures for the firebase package's test infrastructure. `mock.item.ts` defines a synthetic `MockItem` model with converters/identity used as a test bed throughout the workspace.

### Bucket 6 — util/nestjs/dbx-components-mcp/dbx-form (~57 warnings)

- `packages/util/src/lib/cache/cache.memoize.ts` (4)
- `packages/util/src/lib/cache/cache.memory.ts` (4)
- `packages/util/src/lib/cache/cache.merge.ts` (4)
- `packages/util/src/lib/object/object.filter.pojo.ts` (4)
- `packages/util/src/lib/date/expires.ts` (1)
- `packages/nestjs/src/lib/util/cache/cache.file.ts` (8)
- `packages/nestjs/src/lib/util/file/file.json.ts` (5)
- `packages/dbx-components-mcp/src/resources/_resource-helpers.ts` (6)
- `packages/dbx-components-mcp/src/scan/scan-io.ts` (6)
- `packages/dbx-components-mcp/src/resources/auth.resource.ts` (2)
- `packages/dbx-components-mcp/src/tools/index.ts` (2)
- `packages/dbx-components-mcp/src/tools/auth-claim-lookup.tool.ts` (1)
- `packages/dbx-components-mcp/src/tools/auth-list-app.tool.ts` (1)
- `packages/dbx-components-mcp/src/tools/auth-role-lookup.tool.ts` (1)
- `packages/dbx-components-mcp/src/tools/auth-scope-lookup.tool.ts` (1)
- `packages/dbx-components-mcp/src/tools/auth-token-explain.tool.ts` (1)
- `packages/dbx-form/src/lib/forge/field/wrapper/flex/flex.wrapper.ts` (4)
- `packages/dbx-form/src/lib/forge/field/wrapper/formfield/formfield.wrapper.ts` (1)
- `packages/dbx-form/src/lib/forge/form/forge.context.ts` (1)
- `packages/dbx-form/src/lib/form/form.ts` (1)

Notes: Mixed bag of utility libraries. Cache primitives (memoize/memory/merge/file) and POJO filtering. dbx-components-mcp has resource helpers and scan I/O.

## Phase 5 (post-fix observations)

To surface to the user once buckets complete:

- `@typescript-eslint/max-params` threshold of 3 produced multiple legitimate-but-flagged signatures (test helpers, public callbacks). Consider raising to 4 or 5, or scoping the rule with overrides for `*.spec.ts` and `**/test/**`.
- `sonarjs/no-identical-functions` was a false positive on test scaffolding (closures with captured-variable variation). Consider scoping this rule to non-test paths.
- `jsdoc/require-jsdoc` on every exported member of internal packages (CLI, test infrastructure) is high-volume noise. Consider scoping the rule to `packages/util/src`, `packages/dbx-form/src`, `packages/dbx-web/src`, etc. — public-facing surface — and exempting CLI/test infra.
