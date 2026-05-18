# ESLint v10 upgrade guide (for downstream projects)

This guide describes how a downstream `@dereekb/*` consumer can move from ESLint v9 to ESLint v10, mirroring the change applied to `dbx-components` itself. The dbx-components workspace is now on `eslint@10.4.0` and ships its three internal ESLint plugins (`@dereekb/util/eslint`, `@dereekb/nestjs/eslint`, `@dereekb/dbx-web/eslint`) using v10-compatible APIs — they require no source changes.

The whole upgrade is a `package.json` bump, two edits to `eslint.config.mjs`, and a search-and-replace for `import/` → `import-x/` in any in-source `eslint-disable` comments. Total time: well under an hour.

## Prerequisites

ESLint v10 drops support for Node.js prior to `20.19.0`, plus `v21.x` and `v23.x`. Allowed runtimes are `^20.19.0`, `^22.13.0`, or `^24.0.0`. Confirm your `engines.node` and your CI image first.

TypeScript ≥ `5.0` is required by the `@typescript-eslint` v8 line; if you are still on `4.x`, upgrade TypeScript before touching ESLint.

## What actually blocks the upgrade

ESLint v10 itself is a quiet upgrade for flat-config consumers — the legacy `.eslintrc` system was already removed, and the new defaults are sensible. The one real blocker in the ecosystem is `eslint-plugin-import`: its latest release (`2.32.0`, June 2025) does not list ESLint 10 in its peer range and crashes at plugin-load time on v10 with:

```
TypeError: Cannot use 'in' operator to search for 'sourceType' in undefined
```

(see [import-js/eslint-plugin-import#3227](https://github.com/import-js/eslint-plugin-import/issues/3227))

The community migration target is **`eslint-plugin-import-x`** — a drop-in fork with a stricter modern resolver, a leaner dependency tree (16 deps vs. 117), and a peer range of `^8.57.0 || ^9.0.0 || ^10.0.0`. The rule names use an `import-x/` prefix instead of `import/`.

If your project is not using `eslint-plugin-import` (some downstream projects only consume the `@dereekb` rule plugins), you can skip that swap entirely.

## Dependency updates

Replace the following devDependency versions in your root `package.json`. The entries marked **swap** or **remove** require a corresponding `eslint.config.mjs` edit (see next section).

| Package | From | To | Notes |
|---|---|---|---|
| `eslint` | `9.x` | `10.4.0` | Target |
| `@eslint/js` | `9.x` | `10.0.1` | Must match major; peer is `^10.0.0` |
| `@typescript-eslint/eslint-plugin` | `8.x` | `8.59.3` | Already declares `^10.0.0` |
| `@typescript-eslint/parser` | `8.x` | `8.59.3` | Already declares `^10.0.0` |
| `@typescript-eslint/utils` | `8.x` | `8.59.3` | Already declares `^10.0.0` |
| `typescript-eslint` | `8.x` | `8.59.3` | Already declares `^10.0.0` |
| `@angular-eslint/eslint-plugin` | `21.3.x` | `21.4.0` | Angular projects only |
| `@angular-eslint/eslint-plugin-template` | `21.3.x` | `21.4.0` | Angular projects only |
| `@angular-eslint/template-parser` | `21.3.x` | `21.4.0` | Angular projects only |
| `angular-eslint` | `21.3.x` | `21.4.0` | Angular projects only |
| `@nx/eslint` | `22.7.1` | `22.7.2` | Nx projects only |
| `@nx/eslint-plugin` | `22.7.1` | `22.7.2` | Nx projects only |
| `eslint-plugin-unicorn` | `^63` | `^64.0.0` | v64 is the ESLint-10-era release |
| `eslint-plugin-jsdoc` | `^62.x` | `^62.9.0` | Peer declares `^10.0.0`; keep |
| `eslint-plugin-sonarjs` | `^4.x` | `^4.0.3` | Peer declares `^10.0.0`; keep |
| `eslint-plugin-unused-imports` | `4.x` | `4.4.1` | Peer declares `^10.0.0`; keep |
| `eslint-config-prettier` | `10.x` | `10.1.8` | Peer is `>=7`; keep |
| `eslint-plugin-import` | `2.32.0` | — | **Swap** for `eslint-plugin-import-x` |
| `eslint-plugin-import-x` | — | `^4.16.2` | **Add** |
| `@eslint/eslintrc` | `3.x` | — | **Remove** — flat-config-only setups never load `FlatCompat` |
| `eslint-plugin-prettier` | `5.x` | — | **Remove if unused** — most setups rely on `eslint-config-prettier` alone |
| `eslint-import-resolver-typescript` | `4.x` | — | **Remove if unused** — `import-x` ships its own resolver |

Run your package manager and verify there are no peer-dependency warnings:

```bash
pnpm install         # or npm install / yarn install
```

## `eslint.config.mjs` edits

### 1. Swap the `eslint-plugin-import` import

```diff
- import importPlugin from 'eslint-plugin-import';
+ import importPlugin from 'eslint-plugin-import-x';
```

`importPlugin.flatConfigs.recommended` and `importPlugin.flatConfigs.typescript` remain valid entry points — they just expose rules under the `import-x/` prefix instead of `import/`.

### 2. Rename rule references `import/*` → `import-x/*`

Search your config for any rule strings starting with `import/` and rename them. In the dbx-components root config these were:

```diff
  rules: {
-   'import/no-unresolved': 'off',
-   'import/namespace': 'off',
+   'import-x/no-unresolved': 'off',
+   'import-x/namespace': 'off',
  }

  rules: {
-   'import/no-duplicates': ['warn', { considerQueryString: true, 'prefer-inline': true }],
+   'import-x/no-duplicates': ['warn', { considerQueryString: true, 'prefer-inline': true }],
  }
```

### 3. Disable `import-x/default` for TypeScript files

`eslint-plugin-import-x` is stricter than its predecessor about default exports on CJS packages. It will report missing-default-export errors on idiomatic patterns like:

```ts
import tsParser from '@typescript-eslint/parser';
```

TypeScript itself handles this interop, so disable the rule in your TS file group:

```diff
  {
    files: ['**/*.{ts,tsx,mts,cts,html}'],
    rules: {
      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',
+     'import-x/default': 'off' // disabled: TypeScript handles CJS-default interop natively
    }
  },
```

### 4. (Optional) Disable `no-useless-assignment`

ESLint v10 adds three rules to `eslint:recommended`: `no-unassigned-vars`, `no-useless-assignment`, and `preserve-caught-error`. The first and third are usually welcome. The second one flags the common single-return pattern:

```ts
function endsCanonically(text: string): boolean {
  let canonical = false;          // ← flagged as "value assigned but never used"
  if (idx === -1) {
    canonical = true;
  } else {
    canonical = TERMINAL_PUNCTUATION.has(ch);
  }
  return canonical;
}
```

If your project enforces `@dereekb/util/eslint`'s `dereekb-util/require-single-return` (or simply uses this idiom), disable the rule in your TS override block:

```diff
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
+   'no-useless-assignment': 'off' // disabled: conflicts with require-single-return pattern
  }
```

Skip this if your codebase prefers early-returns instead.

## In-source `eslint-disable` comments

Rename any inline disable comments that target `import/<rule>` to `import-x/<rule>`. Typical greps:

```bash
grep -rn "eslint-disable.*\bimport/" src/ packages/ apps/ --include="*.ts" --include="*.mts" --include="*.mjs" --include="*.js"
```

Examples:

```diff
- // eslint-disable-next-line import/export
+ // eslint-disable-next-line import-x/export

- /* eslint-disable import/default */
+ /* eslint-disable import-x/default */
```

## If you have custom ESLint rules

The dbx-components internal plugins (`@dereekb/util/eslint`, `@dereekb/nestjs/eslint`, `@dereekb/dbx-web/eslint`) are already v10-clean — you do not need to touch them. But if your own project ships custom rules, audit each rule's `create()` function for these APIs which ESLint v10 removed:

- `context.getCwd()` → `context.cwd`
- `context.getFilename()` → `context.filename`
- `context.getPhysicalFilename()` → `context.physicalFilename`
- `context.getSourceCode()` → `context.sourceCode`
- `context.parserOptions` → `context.languageOptions.parserOptions`
- `sourceCode.getTokenOrCommentBefore(node, skip)` → `sourceCode.getTokenBefore(node, { includeComments: true, skip })`
- `sourceCode.getTokenOrCommentAfter(node, skip)` → `sourceCode.getTokenAfter(node, { includeComments: true, skip })`
- `sourceCode.isSpaceBetweenTokens(a, b)` → `sourceCode.isSpaceBetween(a, b)`
- `sourceCode.getJSDocComment(node)` → removed; no direct replacement

`RuleTester` also no longer accepts a `type` property on `invalid` errors, or `output`/`errors` on `valid` cases — strip those from your test fixtures.

`@eslint/compat` provides shim wrappers for the removed APIs if a full rewrite is not feasible.

## New behavioural changes that may surface findings

These are not bugs in the upgrade — they are real findings that v10 newly reports:

- **`no-unassigned-vars`** — flags `let x;` with no subsequent assignment.
- **`preserve-caught-error`** — flags `throw new Error(...)` inside a `catch` block when the caught error is not attached as the `cause`. Real bug class; worth addressing inline rather than disabling.
- **JSX reference tracking** — `<MyComponent>` is now treated as a reference to the imported binding, so `no-unused-vars` no longer needs the `@eslint-react/jsx-uses-vars` workaround plugin. If you have it installed, remove it.

## Verification

1. Install and confirm clean peer deps:
   ```bash
   pnpm install
   ```
2. If you have custom rule plugins built to `dist/`, rebuild them:
   ```bash
   pnpm nx run-many -t build-base -p <your-eslint-plugin-projects>
   ```
3. Lint one small project first to catch plugin-load crashes early:
   ```bash
   pnpm nx run <small-project>:lint
   ```
   A successful run (exit 0, or non-zero only due to rule findings, not stack traces) confirms the plugin chain loads on v10.
4. Run the full workspace lint and triage any new findings:
   ```bash
   pnpm nx run-many -t lint
   ```
5. If you maintain custom ESLint rule plugins, run their RuleTester specs to confirm `valid`/`invalid` fixtures still match:
   ```bash
   pnpm nx run-many -t test -p <your-eslint-plugin-projects>
   ```

## Reference: the dbx-components commit

The upstream change in dbx-components is a single commit on `develop`:

```
build($workspace): upgraded eslint to v10

- bumped eslint 9.39.4 → 10.4.0; aligned all eslint plugin peers
- swapped eslint-plugin-import → eslint-plugin-import-x (v10 support)
- removed unused @eslint/eslintrc, eslint-plugin-prettier, eslint-import-resolver-typescript
- disabled import-x/default and no-useless-assignment in root config
- renamed import/* → import-x/* in eslint-disable comments
```

The full diff (root `package.json`, root `eslint.config.mjs`, and four in-source comment renames) is a useful reference if you are wiring this into a fork or template.
