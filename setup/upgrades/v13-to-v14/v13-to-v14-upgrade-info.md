# dbx-components v13 to v14 upgrade info

- Update Nx to v23
- Update Angular to v22 and TypeScript to v6
- Retire the `tsconfig` `baseUrl` ahead of TypeScript 7
- Remove the Vitest/Vite APIs that Nx deprecated for removal in v24
- Move the Angular app's `build` and `serve` onto the `@angular/build:*` builders and drop
  `@angular-devkit/build-angular` for real
- Replace `@Injectable({ providedIn: 'root' })` with Angular 22's `@Service()`
- Build the Firebase API app as ESM instead of CommonJS
- Reshape the `@dereekb/rxjs` `LoadingState` generics — one runtime behavior change, several
  type-parameter reorderings, and five removed exports
- Format with oxfmt instead of prettier
- Add oxlint as a second, fast lint tier **alongside** ESLint — an addition, not a replacement

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

### `@Service()` replaces `@Injectable({ providedIn: 'root' })`

Angular 22 adds a `@Service()` decorator that is the direct replacement for the
`@Injectable({ providedIn: 'root' })` pairing every auto-provided service used to spell out:

| Before | After |
| --- | --- |
| `@Injectable({ providedIn: 'root' })` | `@Service()` |
| `@Injectable()` | `@Service({ autoProvided: false })` |
| `@Injectable({ providedIn: 'root', useFactory: () => x })` | `@Service({ factory: () => x })` |

`autoProvided` defaults to `true`, so `@Service()` is auto-provided and tree-shakeable exactly the
way `providedIn: 'root'` was. This is a change of spelling, not of behavior — the resulting
provider semantics are identical, which is why it can be done as a mechanical sweep.

There is no `@Service` equivalent for the other `providedIn` values. `'platform'`, `'any'`, and
`null` keep `@Injectable`.

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

### zone.js is gone

The Angular apps went zoneless in 13.18, but zone.js stayed installed because the test setup
still loaded it: `@dereekb/vitest/setup-angular` imported `@analogjs/vitest-angular/setup-zone`,
which kept `fakeAsync` / `tick` / `flush` / `waitForAsync` working alongside the zoneless
`TestBed`. As of v14 it imports `@analogjs/vitest-angular/setup-snapshots` instead — the same
Angular fixture snapshot serializers, without zone.js — so nothing in a dbx-components project
loads zone.js and the dependency comes out.

The zone-only test helpers go with it. Angular throws
`zone-testing.js is needed for the fakeAsync() test helper but could not be found` (and the
`waitForAsync()` equivalent) when a spec still calls them, so this fails loudly rather than
quietly. See [Remove zone.js](#remove-zonejs) for the two mechanical rewrites.

### The API app builds as ESM

The Firebase API app's `build-base` now uses `"format": ["esm"]` instead of `["cjs"]`.

The motivating defect: `stripe` v22 publishes a real dual build whose two entries do *not* have
the same shape. The ESM entry has `export class Stripe` alongside `export default Stripe`, while
the CommonJS entry is `module.exports = StripeConstructor` with no `.Stripe` property at all.
Under a CJS bundle, `import { Stripe } from 'stripe'` type-checks (TypeScript resolves types
through `moduleResolution: "bundler"`, which picks the ESM `.d.ts`) and passes Vitest (which runs
ESM), then emits `new import_stripe.Stripe(...)` — `undefined` — and dies in the deployed
container with `TypeError: import_stripe.Stripe is not a constructor`.

The general problem is that the app was the last thing in the workspace still consuming
dependencies through CommonJS interop, while every `@dereekb/*` package is published as ESM.
Two interop models meant a dependency could be imported correctly for one and wrongly for the
other, with nothing in the build or the test suite able to tell the difference.

ESM's interop is the stricter of the two, so this is a real trade rather than a free win: an
unbindable named import is a load-time `SyntaxError` that takes down the whole function instead
of one broken call site. What makes it the right trade here is that the strict direction is
already checked. `tools/scripts/check-esm-named-imports.mjs` has guarded the published packages
against exactly this since `@dereekb/date` shipped an ESM build that named-imported `RRule` from
`rrule`, and as of v14 it also covers the app bundles under `dist/apps`.

### The `LoadingState` generics were reshaped

This is the largest of the three `@dereekb/*` API-surface changes in a v13 to v14 upgrade (the
other two follow below); everything else in this guide is tooling. It is a breaking change on
purpose.

`LoadingState`-generic helpers in `@dereekb/rxjs` were declared two different ways, and neither
worked. The problem is that `LoadingStateValue<L>` is a conditional type:

```ts
export type LoadingStateValue<L extends LoadingState> = L extends LoadingState<infer T> ? T : never;
```

A conditional type is a **non-inferable position**. A signature like
`<L extends LoadingState>(op: OperatorFunction<LoadingStateValue<L>, O>)` can never infer `L` from
its arguments — it only ever arrives via the contextual return type, and degrades to
`LoadingState<unknown>` when there is none. Separately, reading `x.value` where `x: L` resolves
through `L`'s *apparent* type (its constraint), which is `Maybe<unknown>` — which is why v13 carried
a cast at every single `.value` read inside the library.

The other half of the problem was the four-parameter shape
`<A, B, L extends LoadingState<A>, O extends LoadingState<B>>` on `mapLoadingState` and friends: `A`
is only inferable when the caller *annotates* `mapValue`'s parameter, so every call site in
dbx-components annotated it, and one that did not was silently running with `A = unknown`.

v14 states one rule instead. Pick the shape by whether the function preserves the state's shape, and
by whether callers infer or explicitly instantiate:

| Family | Shape | Examples |
| --- | --- | --- |
| **1 — value out** (state shape discarded) | `<T>(): OperatorFunction<LoadingState<T>, X<T>>` | `currentValueFromLoadingState`, `valueFromLoadingState`, `valueFromFinishedLoadingState`, `arrayValueFromFinishedLoadingState`, `promiseFromLoadingState`, `loadingStateFromObs` |
| **2 — shape preserving, value derived** | `<L extends LoadingState>`, with `LoadingStateValue<L>` only in callback-parameter positions | `distinctLoadingState`, `tapOnLoadingState*`, `catchLoadingStateErrorWithOperator`, `startWithBeginLoading`, the four type guards |
| **3 — shape preserving, value transformed** | `<L extends LoadingState, B, O extends LoadingState = LoadingStateWithValueType<L, B>>` — **state first** | `mapLoadingState`, `mapLoadingStateResults`, `MapLoadingStateResultsConfiguration`, `MapLoadingState*Fn` |
| **4 — caller instantiated containers** | value-first `<T, S extends LoadingState<T> = LoadingState<T>>` | `LoadingStateContext`, `ListLoadingStateContext`, `cleanLoadingContext` |

Family 3's ordering is load-bearing rather than cosmetic. TypeScript resolves type parameters left to
right and only evaluates a parameter's default once the ones before it are fixed, so `L` (index 0)
and `B` (index 1) must both resolve before `O` (index 2) can default to
`LoadingStateWithValueType<L, B>`. Any other order collapses `O` and drops the input state's `page`
key. Family 4 keeps its value-first order deliberately: callers write
`cleanLoadingContext<MyData>(obs$)`, and state-first would make the dominant call *more* verbose.

Two guardrails come with the rule, and both will bite anyone writing their own `LoadingState`-generic
helper:

- **G1 — any parameter that mentions the value type must be non-inferable.** Argument inference is
  priority 0 and *wipes* the contextual-return candidate. A plain
  `valueFromFinishedLoadingState<T>(d?: GetterOrValue<T>)` infers `T = never[]` from a `() => []`
  default and then rejects the real stream. Wrap it: `GetterOrValue<NoInfer<T>>`. The same applies to
  `catchLoadingStateErrorWithOperator`, whose operator mentions `L` directly.
- **G2 — `Partial<L>` *is* an inference source.** It is a homomorphic mapped type (priority 8), which
  also outranks the contextual return type, so `startWithBeginLoading(filteredPage)` would
  reverse-infer `L := FilteredPage`. It takes `Partial<NoInfer<L>>` for that reason.

### The forge preset search form was renamed

`@dereekb/dbx-form` exports a small preset search form. Its four symbols were named for the
`DbxForm*` family they predate rather than the `DbxForge*` family they actually belong to, and v13
carried `TODO(migrate)` markers saying as much. v14 does the rename.

| v13 | v14 |
| --- | --- |
| `DbxFormSearchFormComponent` | `DbxForgePresetSearchFormComponent` |
| `DbxFormSearchFormFieldsConfig` | `DbxForgePresetSearchFormFieldsConfig` |
| `DbxFormSearchFormFieldsValue` | `DbxForgePresetSearchFormFieldsValue` |
| `dbxFormSearchFormFields` | `dbxForgePresetSearchFormFields` |

Only the TypeScript symbols move. The component keeps its `dbx-form-search-form` selector and its
`.dbx-form-search-form` host class, so templates and stylesheets are untouched. No deprecated
aliases are kept — the old names are gone, which makes every missed reference a compile error.

### The Zoho related-records `filter` param was removed

`ZohoCrmGetRelatedRecordsRequest.filter` and `ZohoRecruitGetRelatedRecordsRequest.filter` were
`@deprecated` in v13 and are removed in v14.

It was always redundant, and it leaked. `filter` was a `ZohoPageFilter` — `page` and `per_page`,
nothing else — and both request interfaces already extend that same filter, so every key it could
carry was already settable on the request itself.

It also leaked a junk parameter. The related-records factory merged `input` and `input.filter` into
one `URLSearchParams`, which picked the nested page values up, but `input` still carried its own
`filter` key holding that object — and `URLSearchParams` calls `String()` on every value, so each
call using it also appended `filter=%5Bobject+Object%5D` to the query string.

Set `page` / `per_page` on the request directly, which is what the deprecation note already said.

### oxfmt replaces prettier

The workspace formats with [oxfmt](https://oxc.rs/docs/guide/usage/formatter) rather than prettier.
oxfmt is prettier-compatible in output for the settings dbx-components uses, so this is a swap of
the tool, not a reformat of the codebase.

Two things to know before you start:

- **`nx format` does not work on Nx 23.1.3.** That version's `format` command imports prettier
  unconditionally and fails with `Prettier is not installed.` Nx *does*
  [support oxfmt](https://nx.dev/docs/reference/code-formatting) in later versions, selected by
  detection — a root oxfmt config file wins — so adding `.oxfmtrc.json` already makes the workspace
  resolve to oxfmt once Nx is upgraded. Until then, use the npm scripts.
- **`eslint-config-prettier` comes out.** Of the 358 rules it disables, this workspace only ever had
  two enabled, so the whole dependency is replaced by two explicit `'off'` entries at the end of
  `eslint.config.mjs`.

### oxlint is an ADDITION to ESLint, not a replacement

This is the most important thing to understand about the oxlint tier, and it is easy to get
backwards, because oxlint's headline feature is being ~150x faster than ESLint. Faster at *its own*
work — not at yours.

**oxlint does not run your ESLint rules.** It never reads `eslint.config.mjs`. It reads
`.oxlintrc.json`, and the rules it runs are oxc's own Rust *reimplementations* of upstream rule
**names**; where a name overlaps, the implementation differs. The two engines are additive tiers
covering different ground, and neither one's result substitutes for the other's:

| Tier | Engine | Nx target | Owns |
| --- | --- | --- | --- |
| Fast | oxlint | `oxlint` (inferred by `@nx/oxlint`) | the `correctness` category on `.ts/.tsx/.js/.mjs/.cjs` |
| Deep | ESLint | `lint` (explicit, in `project.json`) | everything else — your own plugins, type-aware rules, `.html` templates, `{package,project}.json`, jsdoc/sonarjs/unicorn |

What **cannot** move to oxlint, all measured:

- **Your own ESLint plugins.** oxlint has a `jsPlugins` bridge that can load them, and it does
  support rule fixers — but oxlint's own schema calls it "in alpha and not subject to semver", and
  three of dbx-components' type-aware first-party rules go **silently green** under it rather than
  erroring. A rule that reports nothing is indistinguishable from a rule that passes, so the bridge
  is deliberately off and the in-repo plugins stay on ESLint.
- **Type-aware rules.** oxlint's inferred target carries no type information, so the
  `@typescript-eslint` type-aware set is immovable in practice.
- **`.html` Angular templates — structurally impossible.** oxlint has no HTML parser and, more
  fundamentally, no *processor* concept. This covers inline templates too: ESLint lints a
  `template:` string only because `angular-eslint`'s `processInlineTemplates` processor extracts it
  into a virtual `.html` file first. **Moving your views inline does not make them lintable by
  oxlint** — it relocates the same dependency on the one mechanism oxlint lacks.
- **`.json`** (the `package.json` / `project.json` rules) and **sonarjs**, which has no oxlint
  equivalent at all.

So adopting oxlint does not let you delete anything from your ESLint config. The boundary is drawn
from the *other* side: in `.oxlintrc.json`, every rule ESLint also runs is explicitly `"off"`. A
missed disable there is a duplicate report (visible); a missed disable on the ESLint side would be a
coverage hole (invisible) — which is why the disable list lives with oxlint. oxlint hard-errors on an
unknown rule name, so that list cannot silently rot.

The payoff is real but narrow: `correctness` catches classes of bug an ESLint config typically does
not enable. In dbx-components it found 8 genuine `no-unsafe-optional-chaining` defects, every one of
them the `(a?.b as T).c` form that core ESLint's own rule cannot see, because it reads the ESTree
shape and never unwraps `TSAsExpression`.

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

### Remove zone.js

```
npm uninstall zone.js
```

zone.js is an *optional* peer of `@angular/core`, so removing it leaves no unmet-peer warning,
and no `@dereekb` package declares it. Nothing else needs to change in the setup files: a
downstream `src/test-setup.ts` is just `import '@dereekb/vitest/setup-angular';`, which now
initializes the `TestBed` zonelessly without zone.js present.

Then rewrite the specs that used the zone-only helpers. Both rewrites are mechanical:

```diff
-  beforeEach(waitForAsync(() => {
+  beforeEach(() => {
     TestBed.configureTestingModule({ ... });
-  }));
+  });
```

When the body compiles components, await it instead:

```diff
-  beforeEach(waitForAsync(() => {
-    void TestBed.configureTestingModule({ ... }).compileComponents();
-  }));
+  beforeEach(async () => {
+    await TestBed.configureTestingModule({ ... }).compileComponents();
+  });
```

```diff
-  it('should open the dialog', fakeAsync(() => {
+  it('should open the dialog', async () => {
     sourceInstance.trigger();
-    tick();
-    fixture.detectChanges();
+    await fixture.whenStable();

     expect(matDialog.openDialogs.length).toBe(1);
-
-    flush();
-  }));
+  });
```

`whenStable()` runs change detection and resolves off Angular's pending-task tracking, so it
replaces the `tick()` + `detectChanges()` pair. The trailing `flush()` is dropped rather than
translated: it existed to drain `fakeAsync`'s timer queue, which otherwise failed the test with
`X timer(s) still in the queue`. Zoneless has no such queue to drain.

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

### Migrate `@Injectable({ providedIn: 'root' })` to `@Service()`

Angular ships a schematic for this. It is *not* listed in `@angular/core`'s `migrations.json`, so
`nx migrate --run-migrations` will not run it — you have to invoke it yourself:

```
npx nx g @angular/core:service-migration --path=./packages --dry-run
```

Drop `--dry-run` once the file list looks right. `--path` is relative to the workspace root and
defaults to `./`; the schematic is also aliased as `@angular/core:service`.

What it rewrites, per class:

| Decorator | Becomes |
| --- | --- |
| `@Injectable({ providedIn: 'root' })` | `@Service()` |
| `@Injectable()` | `@Service({ autoProvided: false })` |
| anything else (`providedIn: 'platform'`/`'any'`/`null`, or any second option) | left alone |

It also fixes the `@angular/core` import, but only drops `Injectable` when *every* injectable in
the file migrated — a file with one migratable and one skipped class correctly keeps both imports.

NestJS services are safe. The schematic matches on the decorator actually resolving to
`@angular/core`, so the `@Injectable()` that `demo-api` imports from `@nestjs/common` is never
touched.

#### The schematic silently skips constructor DI

This is the part worth knowing before you run it. The schematic refuses any class whose
constructor — or the constructor of *any* class in its `extends` chain — takes parameters:

```ts
@Injectable({ providedIn: 'root' })
export class MyService {
  constructor(private readonly http: HttpClient) {} // ← not migrated
}
```

There is no warning and no error. The class simply keeps its `@Injectable`, and you are left with
a half-migrated codebase that builds and runs fine. If you want full coverage, run

```
npx nx g @angular/core:inject-migration
```

first to move constructor DI onto `inject()`, then run the service migration.

The base-class half of that rule catches classes that look clean on their own: a service with no
constructor of its own is still skipped if it extends an abstract class whose constructor takes
parameters. Check the whole `extends` chain, not just the decorated class.

#### What dbx-components converted

Only the `providedIn: 'root'` sites — 30 of them, all already on field `inject()`, so none were
skipped. The ~100 bare `@Injectable()` classes (mostly the `*.store.ts` ComponentStore subclasses)
were deliberately left alone: `@Service({ autoProvided: false })` is longer than `@Injectable()`
and buys nothing, so converting them is churn in exchange for a large diff. Run the schematic
without a narrowed `--path` if you would rather have both kinds converted in one pass.

The one `providedIn: null` service (`dbx-web/mapbox`'s `DbxMapboxChangeService`) stays on
`@Injectable`, since there is no `@Service` spelling for it.

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
`@nx/vitest` executor, which is why the scaffolding templates in
`packages/dbx-components-cli/templates` use it.

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

### Switch the API app build to ESM

In the API app's `project.json`, under `build-base`:

```diff
-        "format": ["cjs"],
+        "format": ["esm"],
```

Nothing else in the target changes. The `outputs` still list `main.js`, because
`@nx/esbuild`'s `ESM_FILE_EXTENSION` is already `.js` — the emitted file keeps its name and the
`outExtension: { '.js': '.js' }` in `esbuild.config.js` becomes a no-op that only matters if you
ever go back to `cjs` (where the executor would emit `main.cjs` and break the entry contract).

What actually makes the bundle ESM is the `"type": "module"` that `@nx/js` writes into the
*generated* `dist` `package.json` for an esm-only build. Both halves have to agree: the entry is
still named `.js`, so if that `type` goes missing Node silently parses the bundle as CommonJS
again. Verify it after building:

```
npx nx run <api-app>:build
cat dist/apps/<api-app>/package.json    # expect "type": "module", "main": "./main.js"
```

Then confirm every named import can actually bind, which is the failure mode ESM introduces:

```
npx nx run workspace:check-esm-imports
```

Fix anything it reports by importing the namespace and unwrapping `default` when present — see
`packages/date/src/lib/rrule/rrule.interop.ts` and
`packages/nestjs/twilio/src/lib/twilio.interop.ts` for the established pattern. That shim is only
needed for a dependency that is CommonJS-only. One that publishes a real ESM entry — `stripe` — can
be named-imported directly, which is what `@dereekb/nestjs/stripe` now does; the CJS-safe default
import it briefly carried is no longer necessary once nothing emits CommonJS.

Deployment needs no change. `firebase-tools` resolves the entry as
`path.join(sourceDir, data.main || 'index.js')`, which the generated `main` still satisfies, and
`firebase-functions`' loader handles an ESM entry either way — on Node 24 `require()` of an ESM
module without top-level await simply succeeds and returns the namespace, and its
`ERR_REQUIRE_ESM` / `ERR_REQUIRE_ASYNC_MODULE` branch falls back to a dynamic `import()`
otherwise. Function discovery is unaffected: the endpoint exports are found on the namespace the
same way they were found on `module.exports`.

### Sweep the `LoadingState` API changes

Work these in order — the first one is the only change that does not announce itself with a compile
error.

#### 1. `loadingStateType` now gives `error` precedence over `value`

`loadingStateType` classifies a finished state by checking the error *before* the value:

```ts
// v14
if (isLoading) {
  type = LoadingStateType.LOADING;
} else if (loadingState.error != null) {
  type = LoadingStateType.ERROR;
} else if (objectHasKey(loadingState, 'value')) {
  type = LoadingStateType.SUCCESS;
} else {
  type = LoadingStateType.IDLE;
}
```

A state carrying **both** an error and a value reported `SUCCESS` in v13 and reports `ERROR` in v14.
Such states are produced by `mapLoadingStateResults` / `mapLoadingState` over an error state (they
always write a `value` key), and by `mergeLoadingStateWithError` applied to a state that already had
a value. Anything branching on `LoadingStateType` or on `isLoadingStateInErrorState` can flip,
including template `@switch` blocks over a state type.

Two smaller consequences of the same reorder:

- The error test moved from `objectHasKey(state, 'error')` to `state.error != null`, so
  `{ loading: false, error: undefined }` is now `IDLE` rather than `ERROR`.
- The `value` test is still `objectHasKey`, deliberately: `value: null` remains a meaningful
  "loaded, but empty" signal and still reports `SUCCESS`.

#### 2. Type parameter order and count changes

These compile silently when the positional arguments you were passing still satisfy the new
constraints — they just mean something else. Grep for each name.

| v13 | v14 |
| --- | --- |
| `MapLoadingStateResultsConfiguration<A, B, L, O>` | `MapLoadingStateResultsConfiguration<L, B, O>` |
| `mapLoadingStateResults<A, B, L, O>(input, config)` | `mapLoadingStateResults<L, B, O>(input, config)` |
| `mapLoadingState<A, B, L, O>(config)` | `mapLoadingState<L, B, O>(config)` |
| `MapLoadingStateFn<A, B, L, O>` | `MapLoadingStateFn<L, B, O>` |
| `MapLoadingStateValuesFn<A, B, L>` | `MapLoadingStateValuesFn<L, B>` |
| `MapLoadingStateValueFunction<O, I, L>` | `MapLoadingStateValueFunction<L, O>` |
| `MapLoadingStateValueMapFunction<O, I, L>` | `MapLoadingStateValueMapFunction<L, O>` |
| `mapLoadingStateValueFunction<O, I, L>(mapFn)` | `mapLoadingStateValueFunction<L, O>(mapFn)` |
| `ItemIteration<V, L>` | `ItemIteration<L>` |
| `PageItemIteration<V, L>` | `PageItemIteration<L>` |
| `MappedItemIteration<O, I, M, L, N>` | `MappedItemIteration<M, L, N>` |
| `MappedItemIterationInstance<O, I, M, L, N>` | `MappedItemIterationInstance<M, L, N>` |
| `MappedItemIterationInstanceMapConfig<O, I, M, L>` | `MappedItemIterationInstanceMapConfig<L, M>` |
| `MappedPageItemIteration<O, I, M, L, N>` | `MappedPageItemIteration<M, L, N>` |
| `MappedPageItemIterationInstance<O, I, M, L, N>` | `MappedPageItemIterationInstance<M, L, N>` |
| `mapItemIteration<O, I, M, L, N>(it, config)` | `mapItemIteration<M, L, N>(it, config)` |
| `mappedPageItemIteration<O, I, M, L, N>(it, config)` | `mappedPageItemIteration<M, L, N>(it, config)` |

The iteration types now take loading states rather than item values, because `V` was never used in
`ItemIteration`'s body — every member was already expressed in terms of `L`. Restate an item value as
its state:

```ts
// v13
PageItemIteration<QueryDocumentSnapshotArray<T>>
ItemAccumulator<O, I, N extends ItemIteration<I>>

// v14
PageItemIteration<PageLoadingState<QueryDocumentSnapshotArray<T>>>
ItemAccumulator<O, I, N extends ItemIteration<LoadingState<I>>>
```

The payoff is that the fully-spelled restatements disappear. In dbx-components' own Firestore
iterator, five type arguments (two of which just repeated the other two wrapped in
`PageLoadingState<...>`) became three:

```ts
// v13
export interface FirestoreItemPageIteration<T>
  extends MappedPageItemIterationInstance<QueryDocumentSnapshotArray<T>, FirestoreItemPageQueryResult<T>, PageLoadingState<QueryDocumentSnapshotArray<T>>, PageLoadingState<FirestoreItemPageQueryResult<T>>, InternalFirestoreItemPageIterationInstance<T>> {}

// v14
export interface FirestoreItemPageIteration<T>
  extends MappedPageItemIterationInstance<PageLoadingState<QueryDocumentSnapshotArray<T>>, PageLoadingState<FirestoreItemPageQueryResult<T>>, InternalFirestoreItemPageIterationInstance<T>> {}
```

`ListLoadingStateContext<L, S>` became `ListLoadingStateContext<T, S>` (and the same for
`MutableListLoadingStateContext`, `ListLoadingStateContextConfig`, `ListLoadingStateContextInput`,
`listLoadingStateContext`, and `cleanListLoadingContext`). That is a **rename only** — the order and
meaning are unchanged, so there is nothing to do.

#### 3. Removed exports

| Removed | Replacement |
| --- | --- |
| `FilteredPageLoadingState<T, F>` | Compose at the use site: `PageLoadingState<T> & FilteredPage<F>` |
| `FilteredPageListLoadingState<T, F>` | `PageListLoadingState<T> & FilteredPage<F>` |
| `mapMultipleLoadingStateResults` | Had no callers. Combine with `combineLoadingStates` / `mergeLoadingStatesArray`, then map. |
| `MapMultipleLoadingStateResultsConfiguration` | — |
| `MapMultipleLoadingStateValuesFn` | — |

#### 4. Changed signatures

```ts
// errorResult splits, mirroring toReadableError: only the non-optional form can promise an error.
export function errorResult<T = never>(error: ErrorInput): LoadingStateWithError<T>;
export function errorResult<T = never>(error?: Maybe<ErrorInput>): LoadingState<T>;

// beginLoading's page overload now requires `page`. In v13 the PageLoadingState overload shadowed
// the plain one entirely, so every beginLoading({ ... }) typed as PageLoadingState<T> while the body
// never supplied the required `page`.
export function beginLoading<T = never>(): LoadingState<T>;
export function beginLoading<T = never>(state: Partial<LoadingState<T>> & Page): PageLoadingState<T>;
export function beginLoading<T = never>(state?: Partial<LoadingState<T>>): LoadingState<T>;

// successPageResult now advertises the value key it always set.
export function successPageResult<T>(page: PageNumber, value: T): PageLoadingState<T> & LoadingStateWithValue<T>;

// errorPageResult accepts any ErrorInput, so a plain Error works (it did not in v13).
export function errorPageResult<T = never>(page: PageNumber, error?: Maybe<ErrorInput>): PageLoadingState<T>;

// The three merge helpers no longer claim to return S. Each clears a field that S may require, so
// returning S was a lie for something like LoadingStateWithDefinedValue<Foo>.
export type MergedLoadingState<S extends LoadingState> = Omit<S, 'value' | 'error'> & LoadingState<LoadingStateValue<S>>;

export function mergeLoadingStateWithLoading<S extends LoadingState>(state: S, loading?: boolean): MergedLoadingState<S>;
export function mergeLoadingStateWithValue<S extends LoadingState>(state: S, value: Maybe<LoadingStateValue<S>>): MergedLoadingState<S>;
export function mergeLoadingStateWithError<S extends LoadingState = LoadingState>(state: S, error?: ReadableDataError): MergedLoadingState<S>;
```

The four value/error type guards now intersect their narrowing type with the input state, so a
narrowed `PageLoadingState` keeps its `page` key instead of collapsing to the bare type:

```ts
// v14
export function isLoadingStateWithDefinedValue<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithDefinedValue<LoadingStateValue<L>>;
export function isLoadingStateWithError<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithError<LoadingStateValue<L>>;
export function isLoadingStateFinishedLoadingWithDefinedValue<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithDefinedValue<LoadingStateValue<L>>;
export function isLoadingStateFinishedLoadingWithError<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithError<LoadingStateValue<L>>;
```

Their `| LoadingStateWithDefinedValue<...>` parameter unions are gone. They only existed to satisfy
predicate-assignability against the non-intersected narrowing type, and are dead now.

#### 5. Delete the casts the `T = never` defaults make unnecessary

`beginLoading`, `errorResult`, and `idleLoadingState` default to `T = never`, so a bare call is
assignable into any `LoadingState<Foo>`:

```ts
// v13
of(errorResult(error) as LoadingState<DocumentSnapshot<T>>)
toSignal(store.entriesLoadingState$, { initialValue: beginLoading<EntryMap>() as LoadingState<EntryMap> })
of(beginLoading() as ListLoadingState<any>)

// v14
of(errorResult(error))
toSignal(store.entriesLoadingState$, { initialValue: beginLoading() })
of(beginLoading())
```

Explicit `beginLoading<Foo>()` still compiles; it is just no longer needed to satisfy an assignment.

The same reduction applies to explicit type arguments on the family-1 and family-2 operators, which
now infer from the stream:

```ts
// v13
mapLoadingStateResults<DocValue[], DocValueWithSelection[]>(x, { mapValue: (values) => /* ... */ })
catchLoadingStateErrorWithOperator<LoadingState<NotificationItem<any>[]>>(map(() => successResult([])))

// v14
mapLoadingStateResults(x, { mapValue: (values) => /* ... */ })
catchLoadingStateErrorWithOperator(map(() => successResult([])))
```

#### 6. Adopt the new helpers

| Helper | Replaces |
| --- | --- |
| `isPageLoadingState(state)` | An ad-hoc `'page' in state` test |
| `loadingStateHasNextPage(state)` | `(state as unknown as PageLoadingState)?.hasNextPage` |
| `loadingStateValue(state)` | `state.value as Maybe<LoadingStateValue<L>>` inside a generic helper |
| `loadingStateWithValueType(state, value)` | `{ ...state, value } as unknown as LoadingStateWithValueType<L, T>` |
| `mergeLoadingStatesArray(states, mergeFn?)` | `mergeLoadingStates(...states, mergeFn) as LoadingState<O>` — the array form makes `O` inferable |

`Page` is deliberately kept orthogonal to `LoadingState`; `hasNextPage` was **not** hoisted onto the
base type. `isPageLoadingState` and `loadingStateHasNextPage` are the supported way to ask.

Also note that `valueFromLoadingState()` is **callable for the first time** in v14. Its v13
constraint was `L extends LoadingStateWithDefinedValue`, which can never match a source whose `value`
is optional — which is to say, any real `LoadingState` stream. It had zero call sites for that
reason. Code that hand-rolled `currentValueFromLoadingState()` followed by `filterMaybe()` can
collapse to it.

### Rename the forge preset search form

Four symbols, all mechanical:

```bash
grep -rl 'DbxFormSearchForm\|dbxFormSearchFormFields' src \
  | xargs sed -i '' \
    -e 's/\bDbxFormSearchFormFieldsValue\b/DbxForgePresetSearchFormFieldsValue/g' \
    -e 's/\bDbxFormSearchFormFieldsConfig\b/DbxForgePresetSearchFormFieldsConfig/g' \
    -e 's/\bDbxFormSearchFormComponent\b/DbxForgePresetSearchFormComponent/g' \
    -e 's/\bdbxFormSearchFormFields\b/dbxForgePresetSearchFormFields/g'
```

Drop the `''` after `-i` on GNU sed. Leave `<dbx-form-search-form>` and `.dbx-form-search-form`
alone — the selector and host class did not change, so this is a `.ts` sweep only.

### Drop the Zoho related-records `filter`

Flatten it into the request:

```ts
// v13
getNotesForRecord({ module: 'Contacts', id, fields: 'Note_Title', filter: { page: 2, per_page: 50 } });

// v14
getNotesForRecord({ module: 'Contacts', id, fields: 'Note_Title', page: 2, per_page: 50 });
```

`fields` is unaffected — it was never part of `filter`, and stays required on the notes/attachments
requests.

`grep -rn 'filter:' src | grep -i 'relatedrecords\|getNotesFor\|getEmailsFor\|getAttachmentsFor'`
finds the call sites. A `filter` passed in an object literal is now an excess property and fails to
compile, but one assembled into an intermediate un-annotated variable first will pass the excess
property check and be silently dropped — so run the grep rather than trusting the build.

### Adopt oxfmt

```
npm i -D oxfmt
npm uninstall prettier eslint-config-prettier
```

Add a root `.oxfmtrc.json`. Port your prettier settings across — the option names are the same:

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "arrowParens": "always",
  "bracketSameLine": true,
  "singleQuote": true,
  "trailingComma": "none",
  "semi": true,
  "tabWidth": 2,
  "printWidth": 320,
  "endOfLine": "lf",
  "ignorePatterns": ["/dist", "/coverage", "**/*.generated.*", "*.md"]
}
```

`ignorePatterns` replaces `.prettierignore`; there is no separate ignore file. Note that oxfmt's
patterns do **not** apply to oxlint — the two tools each read their own config.

Then wire the scripts, since `nx format` is unavailable until Nx is upgraded past 23.1.3:

```json
"scripts": {
  "format": "oxfmt --write .",
  "format-check": "oxfmt --check ."
}
```

dbx-components also mirrors these as `workspace:format` / `workspace:format-check` targets in the
root `project.json`, so they are reachable through `nx run`.

Point the husky `pre-commit` hook at oxfmt so staged files are formatted on the way in — see
`.husky/pre-commit` in the dbx-components repo for the version that filters to formattable
extensions, skips deletions, and re-stages only what was already staged.

Finally, disable the two ESLint rules that fight formatter output, replacing `eslint-config-prettier`
at the end of `eslint.config.mjs`:

```js
{
  files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
  rules: {
    'no-unexpected-multiline': 'off',
    'no-extra-semi': 'off'
  }
}
```

Suppress formatting for one statement with `// oxfmt-ignore` (oxfmt also still honors
`// prettier-ignore`).

### Add oxlint as a second lint tier

Optional. Skip it if you do not want a second linter — nothing else in v14 depends on it. Re-read
[oxlint is an ADDITION to ESLint](#oxlint-is-an-addition-to-eslint-not-a-replacement) first, because
the value depends on treating it as additive.

```
npx nx add @nx/oxlint
```

That runs the init generator: it registers the plugin, writes a stub `.oxlintrc.json`, and installs
`oxlint` + `@nx/oxlint`. Then harden it by hand — do not trust the defaults.

**1. Pin the target name in `nx.json`.** The generator's fallback chain starts at `lint`, which your
`project.json` files already own. It lands on `oxlint` here only by accident of ordering:

```json
{
  "plugin": "@nx/oxlint",
  "options": { "targetName": "oxlint" }
}
```

The resulting target is **inferred** — it exists only in the Nx project graph and is never written to
any `project.json`. Anything that discovers targets by reading files off disk will not see it.

**2. Replace the generated `.oxlintrc.json` stub.** Enable only `correctness`, and explicitly turn
`"off"` every rule ESLint also runs:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc"],
  "categories": { "correctness": "error" },
  "ignorePatterns": ["/dist", "/coverage", "/.nx", "**/*.generated.*"],
  "rules": {
    "no-unused-vars": "off",
    "unicorn/no-empty-file": "off"
  }
}
```

Two things make this list safe to maintain: oxlint hard-errors on an unknown rule name, so it cannot
silently rot; and a *missed* disable produces a duplicate report you can see, rather than a coverage
hole you cannot.

Enable `correctness` only. Adding `suspicious` was measured on dbx-components at **4,237 findings,
~90% of them conflicts with deliberate workspace conventions** — 3,066 `no-underscore-dangle` (the
`_`-prefix for intentionally unused bindings), 578 `no-shadow`, 300 `no-extraneous-class` (every
Angular and NestJS module). Re-measure before turning it on.

**3. Add the workspace targets**, alongside the existing `lint-all` rather than replacing it:

```json
"oxlint-all":     { "executor": "nx:run-commands", "options": { "command": "npx nx run-many --target=oxlint --parallel=6" } },
"oxlint-fix-all": { "executor": "nx:run-commands", "options": { "command": "npx nx run-many --target=oxlint --parallel=6 --fix" } }
```

**4. Make sure something actually runs it.** This is the step that is easy to skip and expensive to
skip. A linter that only fires when a human types `nx run <project>:oxlint` accumulates violations
invisibly and then blocks whoever finally wires it up. In dbx-components the tier is reachable
through `dbx-cli-lint-cache --linter oxlint`, which writes `.tmp/lint-cache/<project>.oxlint.json`
plus `index.oxlint.json` (ESLint's `<project>.json` / `index.json` are untouched), and through the
`workspace:oxlint-cache` target that drives it.

#### Do not pass `--silent` to oxlint

Worth its own heading, because it produces a **green run that means nothing**.

Nx forwards unrecognized flags straight through to the underlying command. oxlint's `--silent`
suppresses the diagnostics *inside* `--format=json` while still reporting the scanned-file count — so
a broken run is indistinguishable from a clean one. If you are adapting an ESLint runner that passes
`--silent`, make it conditional on the engine.

Also note oxlint has **no `--output-file`**. Its JSON goes to stdout, interleaved with Nx's
`> nx run …` banner, so a consumer has to extract the JSON object from surrounding text.

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

### A `scan` / `reduce` seed built from a bare loading-state constructor now infers `never`

This is the one place where the `T = never` defaults make previously-working code stop compiling
rather than get simpler. A seed argument is an inference source, so:

```ts
// infers LoadingState<never> and then rejects every real state pushed into the accumulator
scan((acc, next) => /* ... */, beginLoading())
```

Pass the type argument explicitly at a seed: `beginLoading<Foo>()`, `errorResult<Foo>(err)`,
`idleLoadingState<Foo>()`. Nothing in dbx-components hit this — no `scan` or `reduce` seed in the
workspace is built from a loading-state constructor — but downstream code may.

### The `loadingStateType` reorder is the only change with no compile error

Everything else in the `LoadingState` sweep surfaces as a type error somewhere. The error-before-value
reorder does not: a state carrying both an error and a value keeps compiling and silently changes
which branch it takes. If a downstream app renders differently after the upgrade without any build
failure, that is the first thing to check.

Related, and easy to miss: `@dereekb/rxjs` type-level regressions of this class are now pinned by
`packages/rxjs/src/lib/loading/loading.state.types.spec.ts`, which runs under Vitest's `typecheck`
mode. A downstream app can do the same by passing `typecheck: true` to `createVitestConfig` and
adding `*.types.spec.ts` files; the preset points the typechecker at them and excludes them from the
runtime run.
