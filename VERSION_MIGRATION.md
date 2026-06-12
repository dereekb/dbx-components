
## Migration of v13.x.x to v14.x.x
### Overview
Version 14 is a **breaking visual** release for `@dereekb/dbx-web` and `@dereekb/dbx-form`. It
burns down the M2-era visual technical debt that prior passes deliberately preserved, leaning the
component defaults onto Angular Material **M3** system tokens (`--mat-sys-*`). Apps that adopt v14
will see shapes, dividers, and chips render differently unless they opt back in (see below).

v14 also **refactors the dbx color system**: the `.dbx-{color}-bg` classes and the `[dbxColor]`
directive become token providers only (they no longer paint `background`/`color`), painting moves to
the explicit `.dbx-color-bg`/`.dbx-color-text` utilities or to the components themselves, and the
`color` passthrough inputs on `dbx-loading`, `dbx-bar`, `dbx-pagebar`, `dbx-sidenav-*`, and friends
were **removed** in favor of applying `[dbxColor]` directly on the component. `dbx-button`,
`dbx-chip`, and `dbx-step-block` **keep** their `color` inputs — button and chip now host a
`DbxColorDirective` internally and push their resolved color into it (so do not apply `[dbxColor]`
to them). This part of the release IS API (TypeScript) breaking — see the dedicated guide in
[`packages/dbx-web/COLOR_MIGRATION.md`](packages/dbx-web/COLOR_MIGRATION.md).

A full, per-rule before/after ledger lives in
[`packages/dbx-web/VISUAL_CHANGES.md`](packages/dbx-web/VISUAL_CHANGES.md). To preview the new look
under your own theme before upgrading, mount the `<dbx-style-demo>` showcase (from
`@dereekb/dbx-web/style-demo`) in a sandbox route and toggle your light/dark themes.

### Breaking Changes
- **Removed the `dbx.m2-visual-compat()` SCSS mixin.** The `_m2-visual-compat.scss` partial was
  renamed to `_shapes.scss`, and `@dereekb/dbx-web` now only forwards `dbx-components-shapes()`. The
  `m2-visual-compat()` mixin (which restored M2 ~4px shapes, 16px pill chips, and a square list
  indicator) no longer exists.
- **`.dbx-chip` no longer emits the fake `mat-standard-chip` class** and its default corner radius
  changed from a full pill to the M3 "small" corner (`--mat-sys-corner-small`). The chip layout rules
  merged into the base `.dbx-chip` class. See the chip entry in `VISUAL_CHANGES.md`.
- **`.dbx-{color}-bg` classes no longer paint** — they only set `--dbx-bg-color-current` /
  `--dbx-color-current`. Pair them with `dbx-color-bg` to keep a painted background. Plain
  `.dbx-{color}` text classes are unchanged.
- **`[dbxColor]` no longer paints plain elements** — it provides tokens + the `.dbx-color` marker;
  add `dbx-color-bg` on generic elements that relied on the painted background. dbx components paint
  themselves from the tokens.
- **Removed color passthrough inputs** (`color` on `dbx-loading`/`dbx-basic-loading`/
  `dbx-loading-progress`/`dbx-bar`/`dbx-bar-header`/`dbx-pagebar`/`dbx-sidenav`/`dbx-sidenav-page`/
  `dbx-sidenav-pagebar`, and `buttonColor` on `DbxProgressButtonConfig`). Apply `[dbxColor]`
  directly on the component element instead. **Not removed:** `color` on `dbx-button`, `dbx-chip`,
  and `dbx-step-block` — button and chip host a `DbxColorDirective` (via `hostDirectives`) and push
  their resolved color (including `DbxButtonEcho.color`) into it; applying `[dbxColor]` to
  `dbx-button`/`dbx-chip` now throws `NG0309` (duplicate directive).
- **`<dbx-loading>` no longer defaults to `'primary'`** — uncolored loading indicators use the
  Material default indicator color.

### Migration Steps
- **Replace `@include dbx.m2-visual-compat();`** in your theme mixin(s) with one of:
  - `@include dbx.dbx-components-shapes();` — the recommended restrained 8px house style (what the
    dbx-components demo and the new-app scaffold now use), **or**
  - nothing — drop the include entirely to inherit Angular Material's full M3 default shapes, **or**
  - your own root-selector block that sets the `--mat-*-container-shape*` custom properties to the
    values you want to keep.
- If you previously relied on the M2 pill chip, restore it per-app with
  `--dbx-chip-container-shape: var(--mat-sys-corner-full);` (see the chip batch entry). If you
  targeted `.mat-standard-chip` in your own CSS to style dbx chips, retarget `.dbx-chip`.
- Review `packages/dbx-web/VISUAL_CHANGES.md` for the remaining color/divider/typography deltas;
  none require code changes but they do change rendering.
- Follow [`packages/dbx-web/COLOR_MIGRATION.md`](packages/dbx-web/COLOR_MIGRATION.md) for the color
  system refactor: grep recipes for finding static `dbx-{color}-bg` usages (append `dbx-color-bg`),
  removed `color` inputs (rename to `dbxColor`), and `[dbxColor]` on plain painted elements (add
  `dbx-color-bg`), plus the scoped `.dbx-color` SCSS pattern for making your own components respond
  to an external `[dbxColor]`.

## Migration of v11.x.x to v12.x.x
### Overview
Version 11 to 12 stays upgrades dbx-component to Angular 18 and the equivalent Nx version. The minimum number of breaking changes are introduced as possible, but all "compat"/deprecated marked code is cleared again for this major version.

### Breaking Changes


### Migration Steps
Migration/Upgrade info is available in the `setup/v11-to-v12-upgrade-info.md` document.

## Migration of v10.x.x to v11.x.x
### Overview
Version 10 to 11 stays on Angular 16, but updates the build target to ES2022. The change to ES2022 brought about some breaking changes with regards to the implicit "useDefineForClassFields" usage. We decided to just update the entire project to use Angular's inject() and replaced some classes with their pojo/functional equivalent and now force "useDefineForClassFields"=true for all builds.

Some related threads to the useDefineForClassFields usage:
- https://github.com/microsoft/TypeScript/issues/52331
- https://github.com/microsoft/vscode/issues/186726
- https://github.com/ngrx/platform/issues/3654

### Breaking Changes
- `tsconfig.base.json` now targets `ES2022`
- `tsconfig.base.json` now has the configuration `"useDefineForClassFields"=true`, which explicitly declares useDefineForClassFields
- All dbx-components Angular components and directives were update to use Angular's `inject()` functionality and reduced dependency on constructor injection.
- The `AbstractSubscriptionDirective` had the constructor removed. Update any subclasses.
- Many dbx-component classes had their constructor removed where only items were being injected. Child classes no longer need to pass those constructors, so update those classes.
- Updated various LoadingState related functions. A compatability of all the prior functions is available for v11.
- `DbxRouteParamReaderInstance` is now an interface. The getter/setter is replaced with methods.
- `DbxFirebaseIdRouteParamRedirectInstance` is now an interface. The getter/setter is replaced with methods.
- The `DbxTextCompatModule` has been added to include a number of deprecated components that were removed from `DbxTextModule`.
- Renamed `AbstractDbxPresetFilterMenuComponent` to `AbstractDbxPresetFilterMenuDirective`
- Removed deprecated type `HandleActionWithFunctionOrContext` and related deprecated types
- Removed deprecated function `modelFirebaseFunctionMapFactory()`
- Removed deperecated type `FirestoreStringTransformOption` and other deprecated firestore snapshot-type functions
- Removed deprecated string `CREATE_MODEL_APP_FUNCTION_KEY` and related strings
- Removed mergeIntoArray and related types
- Renamed `DbxFormExpandWrapperComponent` and related values. The function was always `expandWrapper()` so this change most likely causes no issues.
- Removed `ZohoRecruitModule` and replaced it will `appZohoRecruitModuleMetadata()`
- Most `PageItemIteration` and related implementations are now functional. `maxPageLoadLimit` is now split into a getter and setter function, instead of a get/set on the variable.
- `MappedItemIterationInstance` and related types are now interfaces with functional implementations. 
- `BooleanKeyArrayUtilityInstance` was removed and replaced with a functional implementation, `booleanKeyArrayUtility`. The `BooleanStringKeyArrayUtility` is now deprecated.
- `DbxAnalyticsStreamEventAnalyticsEventWrapper` is now an interface

## Migration of v9.x.x to v10.x.x
### Migration Steps
Migration/Upgrade info is available in the `setup/v9-to-v10-upgrade-info.md` document.
