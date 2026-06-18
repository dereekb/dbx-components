---
name: dbx__migration__rollup-executor-to-inferred
description: Migration guide for moving dbx-components workspace packages off the deprecated @nx/rollup:rollup executor to @nx/rollup/plugin inferred build-base targets.
---

# Migrate @nx/rollup:rollup → @nx/rollup/plugin inferred targets

## When to use

Use when migrating this workspace's library packages off the deprecated
`@nx/rollup:rollup` executor (removed in **Nx v24**) onto the `@nx/rollup/plugin`
inferred `build-base` targets — either to finish the rollout across the remaining
packages, or to wire a newly-added rollup library the same way.

**Do this migration by hand using the recipe below. Do NOT run
`nx g @nx/rollup:convert-to-inferred`** — it produces a broken workspace here (see
Pitfalls). The migration is incremental and safe: inferred and executor projects
coexist, so packages can be converted group-by-group and verified independently.

The migration is **behavior-preserving**: a migrated project must rebuild
**byte-identical** to its executor output. That checksum diff is the acceptance test
(see Validation).

## Background: how the inferred target works

`@nx/rollup/plugin` infers a `build-base` target for any project containing a
`rollup.config.{js,cjs,mjs,ts,cts,mts}` file. The inferred target runs
`rollup -c rollup.config.cjs` (cwd = project root) and derives `outputs` from the
config's `output.dir`. The shared `withNx()` helper inside the config reproduces
exactly what the executor did, so output matches.

Use **`.cjs`** configs (not `.ts`). A `.ts` config would force `rollup --configPlugin
typescript` and require `@rollup/plugin-typescript` (not installed) plus risky
out-of-rootDir TS compilation of the shared root helper. `.cjs` + `require()` is
robust and needs no new dependency.

## Per-project recipe

For each project still on `@nx/rollup:rollup`:

1. Create `<projectRoot>/rollup.config.cjs` (template below).
2. In `project.json`, **delete the `build-base` executor block** and replace it with an override:
   ```json
   "build-base": {
     "dependsOn": []
   }
   ```
   This merges with the inferred target (keeping its command/outputs/cache) and only
   overrides `dependsOn` — see the Nested-output rule for why this is mandatory.

That's it per project. The plugin is registered once in `nx.json` (see nx.json changes).

## Canonical rollup.config.cjs template

```js
const { withNx } = require('@nx/rollup/with-nx');
const applyVisualizer = require('../../rollup.visualizer.config.cjs'); // path = ../ per dir depth

const options = {
  importPath: '@dereekb/<pkg>',
  main: './src/index.ts',
  outputPath: '../../dist/packages/<pkg>',   // project-root-relative; ../ per depth
  tsConfig: './tsconfig.lib.json',
  project: './package.json',
  compiler: 'swc',
  format: ['esm', 'cjs'],
  external: 'all',
  buildLibsFromSource: false,
  generateExportsField: true,
  optimization: true,
  sourceMap: false,
  extractLicenses: true,
  assets: [ /* copy verbatim from the old project.json build-base options */ ]
};

module.exports = (async () => {
  let config = withNx(options, {});
  config = await applyVisualizer(config, options);
  return config;
})();
```

**Paths are project-root-relative and `.`-prefixed.** `withNx`'s `normalizeRelativePaths`
joins any path starting with `.` to the project root, so `./src/index.ts` → correct, and
`../../dist/packages/<pkg>` resolves to `dist/packages/<pkg>`. Count `../` by directory depth:
`packages/foo` → `../../`, `packages/foo/bar` → `../../../`.

**The async IIFE is required** — the helper modifiers are `async`, and chaining two of them
needs `await`. Even a single helper returns a Promise; export it the same way for consistency.

## The options that MUST be set (and why)

The old config came from three merged sources. The migrated config must fold them all in,
because `withNx`'s `normalizeOptions` defaults differ from the prior effective values:

| Option | Set to | Why — without it |
|---|---|---|
| `external` | `'all'` | nx.json targetDefault supplied this. Omitting → externalizes only package.json deps/peerDeps, **not** graph npm deps. Changes what gets bundled. |
| `buildLibsFromSource` | `false` | targetDefault value. `normalizeOptions` **defaults this to `true`**, which would build deps from source instead of resolving to dist. |
| `compiler` | `'swc'` | `normalizeOptions` defaults to `'babel'`. |
| `generateExportsField` | `true` | `normalizeOptions` defaults to `false`. |
| `optimization`, `sourceMap: false`, `extractLicenses` | (prod values) | The executor used `defaultConfiguration: "production"`, so plain `build-base` ran production. The inferred command has no configurations — bake the **production-effective** option set into the single options object. |

Copy `importPath`, `main`, `outputPath`, `tsConfig`, `project`, and `assets` verbatim from
the old `build-base.options` (assets keep their workspace-relative globs — `withNx` resolves
object-form assets against the workspace root).

## 🔑 The nested-output rule (`dependsOn: []`) — mandatory

The inferred target adds `dependsOn: ['^build-base']`, which the executor never had. Multi-package
groups build sub-packages into a shared parent dir (e.g. `dist/packages/util` contains
`util/test`, `util/fetch`, `util/eslint`). Because sub-packages depend on the main package,
`^build-base` re-triggers the **main** package's `build-base`, whose `deleteOutputPath` wipes
the shared parent — **destroying sibling outputs built earlier**. The symptom is a build that's
missing sub-package directories.

Fix: override **every** migrated `build-base` with `"dependsOn": []` (exact executor parity).
Cross-package ordering is handled by the `build` wrapper's `^build` (an nx.json targetDefault);
within a group the wrapper's sequential `nx:run-commands` order builds the main package first.

## Per-shape variations

All packages are the standard shape above except:

- **alias-internal eslint plugins** (`packages/firebase/eslint`, `packages/dbx-cli/eslint`):
  chain the alias helper **before** the visualizer (match the old `rollupConfig` array order):
  ```js
  const applyInternalAliases = require('./rollup.alias-internal.config.cjs');
  const applyVisualizer = require('../../../rollup.visualizer.config.cjs');
  // ...
  let config = withNx(options, {});
  config = await applyInternalAliases(config, options);
  config = await applyVisualizer(config, options);
  module.exports = config; // (inside the async IIFE)
  ```
  These projects bundle (inline) internal `@dereekb/*` imports; verify the built bundle has
  **no** `require('@dereekb/...')` / `from '@dereekb/...'` import statements (doc-comment
  mentions are fine).

- **no `rollupConfig`** (e.g. `packages/dbx-cli/test`, `packages/firebase-server`,
  `packages/firebase-server/test`): no helper to chain — just `module.exports = withNx(options, {});`.

- **`type: module` packages** (e.g. `@dereekb/dbx-cli`): no special handling. `withNx`
  reconciles format identically to the executor; the byte-identical check confirms it.
  A `.cjs` config loads fine regardless of package `type`.

- **heterogeneous groups**: some sub-projects use `@nx/esbuild:esbuild`, not rollup (e.g. the
  dbx-cli `generate-*`, `lint-cache`, `firebase-api-manifest` CLIs). **Migrate only
  `@nx/rollup:rollup` projects. Leave esbuild projects untouched** — they have no
  `rollup.config.*`, so the plugin ignores them. Confirm with
  `nx show project <p> --json | jq -r '.targets["build-base"].executor'`.

## nx.json changes

Register the plugin once (idempotent — only add if absent):

```json
"plugins": [
  { "plugin": "@nx/rollup/plugin", "options": { "buildTargetName": "build-base" } }
]
```

- **Keep** the `@nx/rollup:rollup` targetDefault while *any* project still uses the executor
  (it still feeds those projects). Remove it only in final cleanup.
- **Leave `useInferencePlugins: false` as-is.** Explicitly-registered plugins run regardless;
  this is proven by byte-identical builds.

## CommonJS helpers

Inferred `.cjs` configs `require()` CommonJS helper files (Node cannot `require()` the `.ts`
helpers the executor loaded). These already exist in this repo:

- `rollup.visualizer.config.cjs` (workspace root) — `module.exports = async (config, options) => config`
- `packages/firebase/eslint/rollup.alias-internal.config.cjs`
- `packages/dbx-cli/eslint/rollup.alias-internal.config.cjs`

If adding a helper to a fresh workspace, port the `.ts` form to CommonJS: `require()` instead of
`import`, and `module.exports = fn` (NOT `export default` — a default export becomes
`module.exports.default`, and `require(...)( )` then throws "is not a function").

## Validation (the acceptance test)

Per group, prove byte-identical output against an executor baseline:

```bash
# 1. BEFORE migrating — capture executor baseline
nx run <pkg>:build --skip-nx-cache
(cd dist/packages/<pkg> && find . -type f ! -path "*/.stats/*" -exec md5 -r {} \; | sort -k2 > /tmp/baseline.md5)

# 2. AFTER migrating — rebuild via inferred targets and diff
nx run <pkg>:build --skip-nx-cache
(cd dist/packages/<pkg> && find . -type f ! -path "*/.stats/*" -exec md5 -r {} \; | sort -k2 > /tmp/after.md5)
diff /tmp/baseline.md5 /tmp/after.md5 && echo "IDENTICAL"
```

Build via the group's **`build` wrapper** (not `build-base` directly), so sub-packages build in
order. Exclude `.stats/` (visualizer HTML is non-deterministic). Also sanity-check the graph:
`nx show project <pkg> --json | jq '.targets["build-base"]'` shows
`command: "rollup -c rollup.config.cjs"` and `dependsOn: []`.

Prefix nx commands with the package manager (`npm exec -- nx ...`). A missing sub-package dir in
the diff = the nested-output rule (`dependsOn: []`) was not applied.

## Final cleanup (only after ALL rollup projects are migrated)

1. Delete the now-unreferenced `.ts` helpers: `rollup.visualizer.config.ts` and both
   `**/eslint/rollup.alias-internal.config.ts`.
2. Remove the dead `@nx/rollup:rollup` targetDefault from `nx.json`.
3. Confirm `grep -rl '@nx/rollup:rollup' packages --include=project.json` returns nothing.

## Pitfalls — why the official generator fails here

`nx g @nx/rollup:convert-to-inferred` breaks this workspace:

1. It emits `.cjs` configs that `require('…rollup.visualizer.config.ts')` — Node can't load `.ts`
   (whole project graph fails with `require(...) is not a function`).
2. It drops the nx.json `@nx/rollup:rollup` targetDefault → loses `external: 'all'` for packages
   that relied on it (e.g. firebase).
3. Its config defaults to the non-production branch though the executor used
   `defaultConfiguration: production` → silently drops `optimization`/`extractLicenses`.
4. It does not add the `dependsOn: []` override → nested-output sibling wipes.

The manual recipe corrects all four.
