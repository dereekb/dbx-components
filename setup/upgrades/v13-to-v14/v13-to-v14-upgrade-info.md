# dbx-components v13 to v14 upgrade info

- Update Nx to v23
- Update Angular to v22 and TypeScript to v6
- Retire the `tsconfig` `baseUrl` ahead of TypeScript 7
- Remove the Vitest/Vite APIs that Nx deprecated for removal in v24
- Move the Angular app's `build` and `serve` onto the `@angular/build:*` builders and drop
  `@angular-devkit/build-angular` for real

## Overview

This update is much smaller than v12 to v13. The bulk of it is dependency version bumps plus
clearing out the Vitest/Vite APIs that Nx has scheduled for removal, so that a later jump to
Nx v24 is a version bump instead of a migration.

The one addition is finishing the webpack removal that v13 only got halfway through — see
[Angular builders](#angular-builders-the-webpack-deprecation-warning-you-are-still-seeing).

### Nx 23

Nx 23 release info is here:

https://nx.dev/blog/nx-23-release

Nothing in Nx 23 breaks a v13 project outright. What it does is start warning about three
APIs that dbx-components relied on, all of which are removed in Nx v24:

| Deprecated | Warning says | Replacement used here |
| --- | --- | --- |
| `@nx/vitest:test` executor | Run `nx g @nx/vitest:convert-to-inferred` | The inferred `@nx/vitest` plugin, or a plain `nx:run-commands` target |
| `nxViteTsPaths` (`@nx/vite/plugins/nx-tsconfig-paths.plugin`) | Replace with `tsconfigPaths()` from `vite-tsconfig-paths` | Vite's built-in `resolve.tsconfigPaths` |
| `nxCopyAssetsPlugin` (`@nx/vite/plugins/nx-copy-assets.plugin`) | Use Vite's `publicDir` or `vite-plugin-static-copy` | Removed entirely — it was a no-op under Vitest |

Because all three were reached through `@dereekb/vitest`'s `createVitestConfig`, most of this
is handled for you by upgrading the package. The parts you still have to do yourself are the
`nx.json` and `project.json` changes described below.

### Angular 22 and TypeScript 6

- Angular updated to 22.1.4.
- TypeScript updated to 6.0.3.
- `baseUrl` has been removed from `tsconfig.base.json`. TypeScript 7 drops support for it, and
  `paths` entries work without it as long as they are written relative to the config file
  (`"@yourorg/util": ["./packages/util/src/index.ts"]`). If your `paths` entries are currently
  written relative to a `baseUrl`, rewrite them with a leading `./` before removing it.

### Angular builders: the webpack deprecation warning you are still seeing

If you followed the v13 notes, `nx serve` still prints this on every start:

```
The "@angular-devkit/build-angular:dev-server" builder is deprecated as part of Angular's
Webpack support deprecation. Use "@angular/build:dev-server" instead.
```

This surprises people, because v13 was where the app moved off the webpack `browser` builder.
The build did move. `serve` did not.

`@nx/angular:dev-server` is not a Vite-native executor. It is a wrapper that imports the
deprecated package unconditionally and hands the whole job to it:

```js
assertPackageIsInstalled('@angular-devkit/build-angular', '@nx/angular:dev-server');
combineLatest([from(import('@angular-devkit/build-angular')), ...])
```

`@angular-devkit/build-angular`'s dev-server logs that banner as the first statement of its
`execute()` — *before* it decides between webpack and Vite.

**You were already on Vite.** Nx patches `context.getBuilderNameForTarget` so that
`@nx/angular:application` reports itself as `@angular-devkit/build-angular:application`, which
makes Angular's `isEsbuildBased()` check pass and routes the serve through Vite. So the banner
is cosmetic as far as *what actually runs* goes.

What is not cosmetic is the dependency. `@nx/angular:dev-server` hard-asserts that
`@angular-devkit/build-angular` is installed, which is why the v13 instruction to "remove
`@angular-devkit/build-angular` from your `devDependencies`" could never actually be carried
out. Those two v13 bullets contradicted each other; this is the resolution.

The fix is to skip the Nx wrappers and use Angular's builders directly. This is also what Nx 23's
own Angular application generator scaffolds — a freshly generated esbuild app in Nx 23 has no
`@nx/angular:*` build or serve executor at all.

### Vitest is no longer run from the workspace root

This is the one behavioral change worth understanding, because it is what breaks quietly.

The old `@nx/vitest:test` executor ran Vitest with the working directory set to the
**workspace root**. The inferred `@nx/vitest` plugin instead generates an `nx:run-commands`
target that runs `vitest run` with the working directory set to the **project directory**.

`createVitestConfig` previously derived the workspace root from `process.cwd()`, so under the
inferred target it resolved to the project directory and every derived path pointed one level
too deep. The symptom is not an error — it is a suite that reports **0 tests** and passes.

As of v14, `createVitestConfig` locates the workspace root by walking up for `nx.json`, so it
produces the same configuration regardless of which directory Vitest is launched from. If you
call `createVitestConfig` you get this for free. If you hand-rolled a Vitest config that assumes
the workspace root is the working directory, fix it before converting your test targets.

## Migrations

### Migrate to Nx 23

```
npx nx migrate 23
npx nx migrate --run-migrations
```

As with the v22 migration, `nx migrate` will rewrite `package.json`, but it is worth manually
checking the versions against the v14 `package.json` of dbx-components rather than trusting the
generated ranges.

Run `npx nx reset` afterwards if you hit stale-cache issues.

### Update dependencies

```
npm uninstall @nx/vite
```

`@nx/vite` was only ever pulled in for the two deprecated plugin helpers. Once
`createVitestConfig` stops calling them, nothing in a dbx-components project imports `@nx/vite`,
so it can be removed outright. Nothing replaces it: path resolution now uses Vite's built-in
`resolve.tsconfigPaths`, so no third-party resolver package is needed either.

Check first that you are not using an `@nx/vite:build`, `@nx/vite:dev-server`, or
`@nx/vite:preview-server` executor anywhere — those are deprecated in Nx 23 as well and need
`nx g @nx/vite:convert-to-inferred` before you can drop the package.

`@nx/vitest` stays: it now provides the inferred plugin rather than the executor.

The `@dereekb/vitest` peer dependencies change accordingly: `@nx/vite` is dropped and nothing
is added in its place.

### Switch the Angular app to the `@angular/build` builders

In your Angular app's `project.json`:

```diff
     "build": {
-      "executor": "@nx/angular:application",
+      "executor": "@angular/build:application",
     },
     "serve": {
-      "executor": "@nx/angular:dev-server",
+      "executor": "@angular/build:dev-server",
     },
```

For most projects this is a straight rename. The Angular schemas are supersets of what the Nx
wrappers accept for everything except the wrapper-only options:

| Wrapper | Options that exist only on the Nx executor |
| --- | --- |
| `@nx/angular:application` | `buildLibsFromSource`, `indexHtmlTransformer`, `plugins` |
| `@nx/angular:dev-server` | `buildLibsFromSource`, `watchDependencies`, `esbuildMiddleware`, `forceEsbuild`, `publicHost`, `disableHostCheck` |

Check your targets against that list before renaming:

- **You set none of them** (the dbx-components default — `buildTarget`, `port`, `proxyConfig`,
  `outputPath`, `assets`, `styles`, `budgets`, `fileReplacements` are all standard Angular).
  Rename and you are done.
- **You set `buildLibsFromSource: false`.** This is the one that needs thought. It is the Nx
  wrapper's mechanism for compiling workspace libraries as prebuilt artifacts rather than from
  source, and Angular's builder has no equivalent. Stay on `@nx/angular:application` for that
  project and accept the warning, or drop the option and build libs from source.
- **You set `plugins` or `indexHtmlTransformer`.** These are esbuild extension points that
  `@angular/build:application` exposes under the same names — verify against its schema rather
  than assuming.
- **Your build is still webpack** (`@angular-devkit/build-angular:browser`). This swap does not
  apply; migrate the build to an esbuild builder first.

Then rekey the executor-keyed entry in `nx.json` `targetDefaults`, which silently stops matching
once the executor name changes:

```diff
 "targetDefaults": {
-  "@nx/angular:application": {
+  "@angular/build:application": {
     "cache": true,
     "dependsOn": ["^build"],
     "inputs": ["production", "^production", "{workspaceRoot}/.browserslistrc"]
   },
```

Miss this and the target falls back to the name-keyed `build` default, quietly dropping
`.browserslistrc` from its cache inputs — a browserslist edit would then serve a stale cached
build. Nothing errors.

Two things that deliberately do **not** change:

- `@nx/angular:package` — the library build executor. It has no Angular equivalent and is not
  deprecated.
- The `@nx/angular:application` key under `nx.json`'s `generators` block. That is the *generator*
  namespace, not the executor namespace, and it is still the right generator to invoke.

Also grep your own tooling for the executor strings. Any script or generator that keys off
`@nx/angular:application` to locate a project's build config (in this repo, a local Nx plugin
that reads `options.tsConfig` off the build target) will silently stop matching and fall through
to its default.

### Drop `@angular-devkit/build-angular`

Only after no target references it:

```
npm uninstall @angular-devkit/build-angular
```

Confirm `@angular/build` is a direct `devDependency` first. It is only an *optional* peer of
`@nx/angular` and `@analogjs/vite-plugin-angular`, so nothing installs it transitively and
removing the other package would otherwise leave the `@angular/build:*` executors unresolvable.

`@angular-devkit/build-angular` remains in `package-lock.json` afterwards as an optional-peer
declaration on those two packages. That is inert — check that the
`node_modules/@angular-devkit/build-angular` *package entry* is gone, not that the string is
absent. Run `npm prune` to drop it from an existing `node_modules`, since removing it from
`package.json` alone leaves the installed copy on disk and the warning would appear to persist.

This also takes webpack itself out of the dependency tree, which is the actual payoff.

### Convert the test targets

There are two ways to do this. The official generator is:

```
npx nx g @nx/vitest:convert-to-inferred
```

It works, but it writes a per-project `include` glob into `nx.json` for every project and copies
the shared `targetDefaults` inline into each `project.json`, so each file gets *larger*. The
dbx-components repo did it by hand instead, which produces a much smaller diff. Either is fine;
the hand-rolled version is described here.

#### 1. Register the plugin once in `nx.json`

```json
{
  "plugins": [
    {
      "plugin": "@nx/vitest",
      "options": {
        "testTargetName": "test",
        "testMode": "run"
      }
    }
  ]
}
```

Note the plugin string is `@nx/vitest`, **not** `@nx/vitest/plugin` — the package has no
`./plugin` export.

`testMode: "run"` makes the inferred target run `vitest run` (once, then exit), matching what
the executor did. The default, `"watch"`, runs bare `vitest`; that still exits because
`createVitestConfig` sets `watch: false`, but `"run"` is unambiguous.

The plugin infers a `test` target for every project directory containing a
`vite.config.*`/`vitest.config.*` file. Scaffolding template directories are not affected, since
they are not project roots.

#### 2. Move the target defaults off the executor key

The `@nx/vitest:test` key in `targetDefaults` no longer matches anything once the executor is
gone. Move its settings onto the target *name*:

```diff
 "targetDefaults": {
-  "@nx/vitest:test": {
-    "cache": true,
-    "dependsOn": ["^build"],
-    "inputs": ["default", "^production", "{workspaceRoot}/vitest.preset.config.mts", "{workspaceRoot}/vitest.setup.*.ts"],
-    "configurations": { "ci": { "ci": true, "codeCoverage": true } }
-  },
+  "test": {
+    "cache": true,
+    "dependsOn": ["^build"],
+    "inputs": ["default", "^production", "{workspaceRoot}/vitest.preset.config.mts", "{workspaceRoot}/vitest.setup.*.ts"],
+    "outputs": ["{projectRoot}/.reports/vitest/{projectName}.junit.xml"]
+  },
+  "run-tests": {
+    "cache": true,
+    "dependsOn": ["^build"],
+    "inputs": ["default", "^production", "{workspaceRoot}/vitest.preset.config.mts", "{workspaceRoot}/vitest.setup.*.ts"],
+    "outputs": ["{projectRoot}/.reports/vitest/{projectName}.junit.xml"]
+  }
 }
```

Two things to be aware of:

- The `configurations.ci` block is dropped. `ci` and `codeCoverage` were **executor options**;
  they mean nothing to the `nx:run-commands` target the plugin generates. If you actually invoke
  `nx test <project> --configuration=ci`, replace it with a configuration that overrides
  `command` (e.g. `"vitest run --coverage"`).
- A name-keyed default applies to *every* target with that name, including any hand-written
  `nx:run-commands` wrapper you have called `test`. In the dbx-components repo this meant the
  Firebase emulator wrapper targets picked up `dependsOn: ["build"]` where previously they had
  none. That is harmless (the inner target already depended on `build`, so it is a cache hit) and
  arguably better, since the build now fails before the emulator boots. Check your own wrappers
  if you rely on them not building.

#### 3. Delete the executor targets from `project.json`

For any project whose test target is a plain vitest run, delete the block entirely and let the
plugin infer it:

```diff
-    "test": {
-      "executor": "@nx/vitest:test",
-      "outputs": ["{options.reportsDirectory}"],
-      "options": {
-        "reportsDirectory": "{projectRoot}/../../coverage/packages/util"
-      }
-    }
```

The `reportsDirectory` option is not worth preserving — `createVitestConfig` already sets
`coverage.reportsDirectory` itself, and the executor option was overriding it to a different
path.

#### 4. Convert the targets that are not named `test`

The inferred plugin only creates one target per project, named by `testTargetName`. Any *other*
target that used the executor has to become an explicit `nx:run-commands` target. In
dbx-components this covers the emulator-wrapped `run-tests` targets and a
`test-skip-build` target:

```diff
     "run-tests": {
-      "executor": "@nx/vitest:test",
-      "outputs": ["{options.reportsDirectory}"],
+      "executor": "nx:run-commands",
       "options": {
-        "reportsDirectory": "{projectRoot}/../../coverage/packages/firebase"
+        "command": "vitest run",
+        "cwd": "{projectRoot}"
       }
     }
```

Keep the `run-tests` name if you use `exec-with-emulator.sh` — the script (and the dbx tooling)
keys off that target name to decide whether a project needs the Firebase emulator.

This `nx:run-commands` form is fully self-contained: it needs no inferred plugin and no
`@nx/vitest` executor, which is why the scaffolding templates in `setup/templates` use it.

### Verify the conversion

The failure mode here is silent, so check the target count rather than just running the suite.
Dump the project graph before and after and compare:

```
npx nx graph --file=/tmp/graph.json
```

Then confirm that every project that had a `test`/`run-tests` target still has one, and spot
check that a suite reports a non-zero test count:

```
npx nx test <project> --skip-nx-cache
```

**If a suite reports `0/0 passed`, the conversion is broken, not clean.** It means the config's
`root` is resolving relative to the project directory instead of the workspace root. Upgrading
`@dereekb/vitest` to v14 fixes this for `createVitestConfig` users.

### Verify the builder swap

```
npx nx run <app>:build:development --skip-nx-cache
npx nx run <app>:serve
```

The serve output should print a `[vite]` line and a `Local: http://localhost:<port>/` with no
deprecation banner above it. Do this *after* `npm prune`, not before — with the package still on
disk the swap can look successful while an unnoticed target is still pulling it in.

## Notes and gotchas

### tsconfig path resolution only discovers `tsconfig.json` / `jsconfig.json`

Neither Vite's built-in resolution nor the `vite-tsconfig-paths` package discovers
`tsconfig.base.json` by name. They find each project's `tsconfig.json` and follow `extends` up to
the base config, which is how the `paths` entries are picked up.

The consequence: a file that sits at the workspace root, outside any project's `tsconfig.json`
scope, gets no path mapping. In this repo the workspace-root Vitest setup shims
(`vitest.setup.node.ts` and friends) hit exactly that, and now import the source directly:

```diff
-import '@dereekb/vitest/setup-node';
+import './packages/vitest/src/setup-node';
```

This only applies to the dbx-components repo itself, where `@dereekb/vitest` is not installed in
`node_modules`. In a downstream project the package resolves normally from `node_modules` and
the shims should keep importing `@dereekb/vitest/setup-node`.

If you hit this on your own root-level files, the alternative is to add a root `tsconfig.json`
that extends `tsconfig.base.json`.

### Path resolution uses Vite's built-in `resolve.tsconfigPaths`

`createVitestConfig` sets it directly:

```ts
resolve: {
  tsconfigPaths: true;
}
```

Vite 8 prints a notice recommending this over the `vite-tsconfig-paths` package, and it is what
replaced the deprecated `nxViteTsPaths`. It needs no equivalent of that package's
`ignoreConfigErrors`: it already tolerates the scaffolding templates' `tsconfig.json` files,
which contain placeholder tokens and are not valid JSON.

The one caveat: the option is flagged `@experimental` in Vite's own type definitions as of Vite
8. We took it anyway rather than carry a dependency we would only have to remove later — v14 is
the right window for that kind of change. If a future Vite release breaks it, the fallback is a
two-line revert to `plugins: [tsconfigPaths({ root: rootDir, ignoreConfigErrors: true })]` from
the `vite-tsconfig-paths` package.

Note that neither resolver avoids the workspace-root file problem described above: Vite's
built-in resolution has the same limitation and also fails to map paths for a file outside any
project `tsconfig.json` scope.

### `nxCopyAssetsPlugin` needed no replacement

Its only real work happens in the Rollup `writeBundle` hook, which Vitest never calls because a
test run produces no bundle. It was dead weight in a test config, so it was removed rather than
replaced. (It was also being applied twice for Angular projects.)

### The v12 to v13 notes are stale on Angular executors

`setup/upgrades/v12-to-v13/v12-to-v13-upgrade-info.md` still tells you to move `build` to
`@nx/angular:application` and `serve` to `@nx/angular:dev-server`, and then, a paragraph later,
to remove `@angular-devkit/build-angular`. Those cannot both be done — the second executor
requires the package. That page has been left as-is as a historical record; the instructions
above supersede it.

### Docker-based emulator tests need an image rebuild

`docker-compose.yml` mounts `/code/node_modules` as an anonymous volume, which masks the host's
`node_modules` with the copy baked into the image. Any dependency change is therefore invisible
inside the container until you rebuild:

```
docker compose build demo-api-server
```

Without this you get a `Cannot find module '…'` from the containerized test run while the same
command works fine on the host. This bit us mid-upgrade and is worth remembering any time a
dependency moves.
