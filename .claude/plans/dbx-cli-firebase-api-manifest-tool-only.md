# Plan — make dbx-cli-firebase-api-manifest a tooling-only Nx project

## What changed in intent

The previous attempt extracted both the runtime reader (`buildManifestCommands` + `CliApiManifest` types) and the build-time generator into a publishable subpackage at `packages/dbx-cli/firebase-api-manifest/`. That bloated the rollup config (transitive `@dereekb/firebase` → `@dereekb/date` walks tripped TS6059, see `packages/dbx-cli/firebase-api-manifest/package.json`'s growing peerDep list) and forced a third-party-style import path on consumers that never needed one.

The new intent: this Nx project is a **tool**, not a library.

- The runtime reader and types live back in `@dereekb/dbx-cli` (where they were before this whole effort started).
- The new project's `build` target produces exactly one artifact: `dist/packages/dbx-cli/firebase-api-manifest/main.js` — the generator binary that downstream CLI apps invoke as a Nx target dependency.
- Nothing imports `@dereekb/dbx-cli/firebase-api-manifest` from TypeScript. There is no published package, no peerDeps, no path mapping, no `build-base` rollup target.

## End state

```
packages/dbx-cli/
├── package.json                      arktype back in peerDeps
├── project.json                      build / build-base / lint / test
├── tsconfig.json                     references lib + spec only
├── tsconfig.lib.json                 no scripts exclude
├── src/
│   └── lib/
│       ├── index.ts                  re-exports manifest barrel
│       └── manifest/
│           ├── index.ts              barrel
│           ├── types.ts              CliApiVerb / CliApiManifestEntry / CliApiManifest / CliApiManifestField
│           └── build-manifest-commands.ts   relative imports to ../context, ../util/output
└── firebase-api-manifest/
    ├── package.json                  "private": true; only devDependencies (prettier, ts-morph)
    ├── project.json                  single `build` (esbuild) + `lint` targets
    ├── eslint.config.mjs             extends ../../../eslint.config.library.mjs
    ├── tsconfig.json                 references tsconfig.tool.json
    ├── tsconfig.tool.json            module: esnext, moduleResolution: bundler, types: ["node"]
    └── src/
        └── generate-api-manifest/
            ├── main.ts               entry (import paths still relative within this dir)
            ├── parse-functions.ts
            ├── resolve-package.ts
            ├── find-api-files.ts
            ├── extract-crud.ts
            ├── bind-validators.ts
            ├── emit.ts               emits `import { type CliApiManifest } from '@dereekb/dbx-cli';`
            └── types.ts
```

`dist/packages/dbx-cli/firebase-api-manifest/main.js` is the lone build output.

## Step-by-step

### A. Move runtime back to @dereekb/dbx-cli

1. Recreate `packages/dbx-cli/src/lib/manifest/`:
   - `types.ts` — copy from `packages/dbx-cli/firebase-api-manifest/src/lib/types.ts` (unchanged content).
   - `build-manifest-commands.ts` — copy from current location and **revert imports** to relative:
     ```ts
     import { requireCliContext } from '../context/cli.context';
     import { CliError, outputError, outputResult } from '../util/output';
     import { type CliApiManifest, type CliApiManifestEntry } from './types';
     ```
     (Keep `OnCallTypedModelParams` import from `@dereekb/firebase`.)
   - `index.ts` — `export * from './build-manifest-commands'; export * from './types';`
2. `packages/dbx-cli/src/lib/index.ts` — restore `export * from './manifest';` between `env` and `middleware`.
3. `packages/dbx-cli/package.json` — add `"arktype": "^2.2.0"` back to `peerDependencies`.

### B. Slim the new subpackage to scripts-only

1. Move scripts from `packages/dbx-cli/firebase-api-manifest/scripts/generate-api-manifest/` to `packages/dbx-cli/firebase-api-manifest/src/generate-api-manifest/`. (Cleaner — `src/` is the project's only source root.)
2. Delete `packages/dbx-cli/firebase-api-manifest/src/lib/` (entire dir — no runtime here).
3. Delete the now-empty `scripts/` directory.
4. Update `emit.ts` to emit:
   ```ts
   import { type CliApiManifest } from '@dereekb/dbx-cli';
   ```
   (Reverts the path back to the parent package.)
5. Update `main.ts` usage banner:
   ```
   node dist/packages/dbx-cli/firebase-api-manifest/main.js \
   ```

### C. Replace project config with a tooling-only setup

1. **`packages/dbx-cli/firebase-api-manifest/package.json`:**
   ```json
   {
     "name": "@dereekb/dbx-cli-firebase-api-manifest",
     "version": "13.10.9",
     "private": true,
     "type": "module",
     "devDependencies": {
       "prettier": "3.8.3",
       "ts-morph": "^21.0.0"
     }
   }
   ```
   - `private: true` (never published).
   - Drop `bin`, `peerDependencies`, `sideEffects`.
   - The `name` no longer uses a slash — Nx project name stays `dbx-cli-firebase-api-manifest`.

2. **`packages/dbx-cli/firebase-api-manifest/project.json`:**
   ```json
   {
     "name": "dbx-cli-firebase-api-manifest",
     "$schema": "../../../node_modules/nx/schemas/project-schema.json",
     "sourceRoot": "packages/dbx-cli/firebase-api-manifest/src",
     "projectType": "application",
     "tags": [],
     "implicitDependencies": [],
     "targets": {
       "build": {
         "executor": "@nx/esbuild:esbuild",
         "outputs": ["{workspaceRoot}/dist/packages/dbx-cli/firebase-api-manifest"],
         "defaultConfiguration": "production",
         "options": {
           "outputPath": "dist/packages/dbx-cli/firebase-api-manifest",
           "main": "packages/dbx-cli/firebase-api-manifest/src/generate-api-manifest/main.ts",
           "tsConfig": "packages/dbx-cli/firebase-api-manifest/tsconfig.tool.json",
           "format": ["esm"],
           "platform": "node",
           "target": "node20",
           "bundle": true,
           "thirdParty": false,
           "skipTypeCheck": false,
           "declaration": false,
           "esbuildOptions": {
             "banner": {
               "js": "#!/usr/bin/env node\nimport { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);"
             }
           }
         },
         "configurations": {
           "production": {
             "minify": false,
             "sourcemap": false
           }
         }
       },
       "lint": {
         "executor": "@nx/eslint:lint",
         "outputs": ["{options.outputFile}"]
       }
     }
   }
   ```
   - `projectType: "application"` (tool, not a library).
   - One target: `build` (esbuild → `main.js`). No rollup, no `build-base`, no `build-scripts`.
   - No `test` / `run-tests` (no specs exist; can be added later if needed).

3. **`packages/dbx-cli/firebase-api-manifest/tsconfig.json`:**
   ```json
   {
     "extends": "../../../tsconfig.base.json",
     "files": [],
     "include": [],
     "references": [{ "path": "./tsconfig.tool.json" }]
   }
   ```

4. **`packages/dbx-cli/firebase-api-manifest/tsconfig.tool.json`:**
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "outDir": "../../../dist/out-tsc",
       "module": "esnext",
       "moduleResolution": "bundler",
       "target": "ES2022",
       "declaration": false,
       "types": ["node"]
     },
     "include": ["src/**/*.ts"]
   }
   ```

5. **`packages/dbx-cli/firebase-api-manifest/eslint.config.mjs`** — unchanged (already extends `../../../eslint.config.library.mjs`).

6. Delete `tsconfig.lib.json`, `tsconfig.scripts.json`, `tsconfig.spec.json`. Only `tsconfig.json` + `tsconfig.tool.json` remain.

### D. Drop the package path mapping

Remove from `tsconfig.base.json` `compilerOptions.paths`:
```json
"@dereekb/dbx-cli/firebase-api-manifest": ["packages/dbx-cli/firebase-api-manifest/src/index.ts"],
```
Nothing imports the package by name anymore.

### E. Re-wire demo-cli

1. `apps/demo-cli/src/index.ts` — revert to single import:
   ```ts
   import { buildManifestCommands, runCli } from '@dereekb/dbx-cli';
   ```
2. `apps/demo-cli/package.json` — remove `@dereekb/dbx-cli/firebase-api-manifest` peer dep.
3. `apps/demo-cli/project.json` `generate-api-manifest`:
   ```json
   "generate-api-manifest": {
     "executor": "nx:run-commands",
     "outputs": ["{projectRoot}/src/lib/manifest/api.manifest.generated.ts"],
     "dependsOn": [{ "projects": ["dbx-cli-firebase-api-manifest"], "target": "build" }],
     "inputs": [
       "{workspaceRoot}/dist/packages/dbx-cli/firebase-api-manifest/main.js",
       "{workspaceRoot}/components/demo-firebase/src/lib/functions.ts",
       "{workspaceRoot}/components/demo-firebase/src/lib/**/*.api.ts",
       "{workspaceRoot}/packages/firebase/src/lib/model/**/*.api.ts"
     ],
     "options": {
       "command": "node dist/packages/dbx-cli/firebase-api-manifest/main.js --project=demo-cli --functions-config=components/demo-firebase/src/lib/functions.ts --output=apps/demo-cli/src/lib/manifest/api.manifest.generated.ts",
       "cwd": "{workspaceRoot}"
     }
   }
   ```
4. Keep `dbx-cli-firebase-api-manifest` in `implicitDependencies` (already added).

### F. Restore dbx-cli's lint scope

The previous attempt's lint output showed dbx-cli linting files inside `firebase-api-manifest/scripts/` because `@nx/eslint:lint` walks `projectRoot`. With the subpackage having its own project.json, Nx auto-excludes it (precedent: `dbx-firebase` → `dbx-firebase/oidc`). After section C, dbx-cli's lint should stop reporting the subpackage's files automatically. If it still does, scope explicitly:
```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["packages/dbx-cli/src/**/*.{ts,tsx}"]
  }
}
```

### G. Verify

Order matters because `demo-cli:build` chains via `generate-api-manifest`.

```
pnpm nx reset
pnpm nx run dbx-cli-firebase-api-manifest:lint        # 0 errors
pnpm nx run dbx-cli-firebase-api-manifest:build       # produces dist/.../main.js (one file)
ls dist/packages/dbx-cli/firebase-api-manifest/main.js
node dist/packages/dbx-cli/firebase-api-manifest/main.js --project=demo-cli \
  --functions-config=components/demo-firebase/src/lib/functions.ts \
  --output=apps/demo-cli/src/lib/manifest/api.manifest.generated.ts
# expect: Summary: 6 groups · 34 entries · 34 validators bound · 0 missing · 1 skipped

git diff -- apps/demo-cli/src/lib/manifest/api.manifest.generated.ts
# expect: only the import line, restored to:
#   import { type CliApiManifest } from '@dereekb/dbx-cli';

pnpm nx run dbx-cli:lint                              # clean (no firebase-api-manifest leakage)
pnpm nx run dbx-cli:build                             # green
pnpm nx run dbx-cli:test                              # 68 tests
pnpm nx run demo-cli:lint                             # clean
pnpm nx run demo-cli:build                            # chains generate-api-manifest → build
node dist/apps/demo-cli/index.js --help               # 11 model commands
node dist/apps/demo-cli/index.js profile --help       # 7 profile actions including update
```

If `dbx-cli:lint` still reports firebase-api-manifest files, apply the explicit `lintFilePatterns` from section F.

Don't commit. Leave the working tree dirty.

### H. Change-log

Append to `~/.claude/cloud-sync/log/dbx-components/dbx-cli-firebase-api-manifest-subpackage.md`:

- Date, summary of the pivot.
- Files added / modified / deleted (compared to the prior session's state):
  - **Restored to dbx-cli:** `packages/dbx-cli/src/lib/manifest/{index,types,build-manifest-commands}.ts`.
  - **Restored:** `arktype` peerDep in `packages/dbx-cli/package.json`.
  - **Restored:** `export * from './manifest';` in `packages/dbx-cli/src/lib/index.ts`.
  - **Removed:** `@dereekb/dbx-cli/firebase-api-manifest` path mapping from `tsconfig.base.json`.
  - **Slimmed:** `packages/dbx-cli/firebase-api-manifest/` to scripts-only Nx project (esbuild → `main.js`).
  - **Reverted:** `apps/demo-cli/src/index.ts` single-import; `apps/demo-cli/package.json` peer-dep dropped; `apps/demo-cli/project.json` points at the new bin.
- Note: `dbx-cli-firebase-api-manifest` is now an `application`-typed Nx project (private, not published). Its sole output is `dist/packages/dbx-cli/firebase-api-manifest/main.js`.
- Query verbs remain the deferred follow-up (preserved `SUPPORTED_VERBS` comment in `src/generate-api-manifest/extract-crud.ts`).

## What NOT to do

- Do **not** add a `build-base` rollup target. The runtime is back in `@dereekb/dbx-cli`; this project is generator-only.
- Do **not** keep `@dereekb/dbx-cli/firebase-api-manifest` as an importable package name. Drop it from `tsconfig.base.json` paths, demo-cli's `package.json`, and emit.ts's emitted import.
- Do **not** publish the subpackage. `private: true` enforces this.
- Do **not** reintroduce `.mjs` scripts.
- Do **not** commit changes.

## Open questions

- Should the project name be renamed (e.g. `dbx-cli-tools-generate-api-manifest`) since it's now closer to a build script than a publishable artifact? Default: keep `dbx-cli-firebase-api-manifest` for continuity with the existing `dependsOn` wiring; rename later if a second tool joins.
