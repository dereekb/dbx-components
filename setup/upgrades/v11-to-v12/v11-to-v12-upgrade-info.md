# dbx-components v11 to v12 upgrade info
- Update Nx to v19
- Update Angular to v18

## Migrations
We are jumping from Nx version 16 to version 18. It is important to run two independent migrations to ensure everything gets up to date properly.

### Migrate to Nx 17
Nx 17 release info is here:

https://nx.dev/blog/nx-17-release#better-typesafety-across-modules
https://nx.dev/blog/nx-17-2-release#nx-release-updates

First run the following:

```nx migrate 17```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` for the v11 of dbxcomponents.

#### package.json changes
- Updated all 3rd-party packages to their angular 17 supported version
- Replaced `angular-resize-event` -> `angular-resize-event-package`, as the original package is no longer maintained. See https://github.com/vdolek/angular-resize-event/issues/102

#### Run the migrations
- run ```npx nx migrate --run-migrations```. You can ignore the errors on the terminal that look like the following:
 
```Skipping migration for project demo. Unable to determine 'tsconfig.json' file in workspace config.```

The dbx-components library is unaffected by these migrations in particular. However, you can resolve the issue with the following steps describe in this issue:

https://github.com/nrwl/nx/issues/20172#issuecomment-1825783434

The command-line steps we used are as follow:

- run ```nx g @nx/plugin:plugin tools/my-plugin```. Just use the "my-plugin" name as-is, this is only temporary:
- run ```nx generate @nx/plugin:generator tools/my-plugin/src/generators/my-generator```
- copy the files from the issue/comment above
- run ```nx generate tools/my-plugin/src/generators/my-generator``` and answer "false" to the question
- run ```npx nx migrate --run-migrations```. This may take a while depending on the size of the project.
- run ```nx generate tools/my-plugin/src/generators/my-generator``` and answer "true" to the question to undo the generator's changes
- 
(After doing this step it is a good idea to commit the changes on git before continuing)

### Updating Projects
- the `ng-package.json` of sub-packages (e.g. `dbx-web/mapbox`) need to be updated to remove the `dest` property as it is now properly detected as invalid configuration. Leave the `dest` property on the parent package (e.g. `dbx-web`). This property apparently had no effect when used in the sub-package. Read more here: https://github.com/ng-packagr/ng-packagr/issues/2767
- Prior we also called run-commands to build each of the sub-packages independently, but this is no longer needed. In-fact, running them will cause our now updated config to behave as a non-sub package and output a dist folder into our src, which is not desired.

### Updating Packages - BREAKING CHANGES
#### Mapbox
There have been several type changes to mapbox past version 3.0.1. dbx-web/mapbox has been updated to export these types that were removed/discarded. Your project may need to be updated if it used some of these types. The minimum version of mapbox allowed now is `v3.10`.

The `mapbox-gl` package has also been updated to use the `dist` folder instead of the `src` folder. Update the `styles` property in the build configuration to reference `mapbox-gl/dist/mapbox-gl.css` instead of `mapbox-gl/src/css/mapbox-gl.css`.

#### Firebase
- The function definition for `StreamDocsWithOnSnapshotFunctionParams.next` has been updated to only pass the value, and never pass undefined to match with the observable.
- The various app provider functions (`provideFirebaseApp()`, `provideAppCheck()`, `provideFirestore()`, `provideAuth()`, `provideStorage()`, `provideFunctions()`) from `@angular/fire/functions` now returns providers instead of a module.
- Added `provideDbxFirebaseApp()` to replace the `DbxFirebaseDefaultFirebaseProvidersModule`. The `DbxFirebaseDefaultFirebaseProvidersModule` is now deprecated, but still functional. The other individual modules have been removed.
- Added `provideDbxFirebase()` to replace having to include the dbx-firebase configuration modules with in all-in-one provider.

### NodeJS
v12 requires NodeJS version 22 or greater. This project is specifically targeting NodeJS 22.14.

You'll need to update the following:
- `Dockerfile`: Update FROM to use `node:22.14-bookworm`
- `package.json`: Update the `engines` to use `22`. Also update `@types/node` to `22.13.0`
- `circleci/config.yml`: Update the `cimg/node` version to `22.14`

### TypeScript
After the update Typescript was throwing errors related to the NodeJS types not being available while building Demo. Updated `tsconfig.json` for the project to include the following under `compilerOptions`: `"types": ["node"]`, or add `node` to the existing types. This is probably not necessary for projects importing dbx-components.

### Migrate to Nx 18
Nx 18 release info is here:

https://nx.dev/blog/launch-nx-week-recap#nx-180-project-crystal

First run the following:

```nx migrate 18```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` with any other dependencies.

Nx 18 had no changes with Angular, still using Angular 17.

#### update package.json changes
- Update all packages for their respective versions for Nx 18. This was mainly `@jscutlery/semver` while updating.

#### Run the migrations
Run ```npx nx migrate --run-migrations```. These are mainly minor updates to `package.json` and `nx.json`.

### Migrate to Nx 19
Nx 19 release info is here:

https://nx.dev/blog/nx-19-release

First run the following:

```nx migrate 19```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` with any other dependencies.

#### package.json changes
- Updated all 3rd-party packages to their angular 18 supported version

#### Run the migrations
Run ```npx nx migrate --run-migrations```. These are mainly minor updates to `package.json` and `nx.json`.

### Updating Packages - BREAKING CHANGES
#### Angular Material
Angular Material 18 added Material v3 to the mix as the new default, so usage of Material 2 is updated to be specifically referenced:

```
$app-typography-config: mat.define-typography-config
```

to:

```
$app-typography-config: mat.m2-define-typography-config
```

The Nx migration will handle this name change, but it is noted here for posterity.

The dbx-components sass internally used a lot of `@angular/material` sass, so it required some updates to the scss to reference the m2- prefix. There shouldn't be any updates required to your code to make use of the changes.

#### UIRouter
UIRouter has been updated with stand-alone support, so UIView can no longer be referenced by modules and doesn't need to be imported.

#### Updating Application Build Executors
ESBuild support for building Angular projects was added in Angular 17. You can replace `@angular-devkit/build-angular:browser` with `@nx/angular:application` to use the new application builder. You will have to make the following changes:

- Replace `@angular-devkit/build-angular:browser` with `@nx/angular:application`
- Remove `buildOptimizer` and `vendorChunk` options. If you do not, the builder will throw an error while building, complaining about extra options.

For dbx-components demo, we had to add the `""` path to `stylePreprocessorOptions` so that `@forward 'node_modules/@angular/...` would resolve properly from `@dereekb/dbx-web` but `demo` builds using the sass/typescript from those projects directly and not the dist folder. It did not seem to be needed before.

#### Other Build Issue Notes
There was a relatively cryptic build error after making the above changes: 

```
------------------------------------------------------------------------------
Building entry point '@dereekb/dbx-firebase'
------------------------------------------------------------------------------
✖ Compiling with Angular sources in Ivy full compilation mode.

 NX   Cannot destructure property 'pos' of 'file.referencedFiles[index]' as it is undefined.

Pass --verbose to see the stacktrace.

```

At some point there were some dependency loops that seemed to arise during the update that aren't properly detected as such. 

```
// error
import { DbxFirebaseEmulatorService } from '../firebase';

// fixed
import { DbxFirebaseEmulatorService } from '../firebase/firebase.emulator.service';
```

```
// error
import { Maybe, pushArrayItemsIntoArray } from 'packages/util/src/lib';

// fixed
import { Maybe, pushArrayItemsIntoArray } from '@dereekb/util';
```

#### app-api build
dbx-components demo-api failed to build with the following error:

```
> nx run demo-api:build-base

 NX   Using "isolatedConfig" without a "webpackConfig" is not supported.

Pass --verbose to see the stacktrace.
```

Solution: https://github.com/nrwl/nx/issues/20671#issuecomment-1850635321


#### Module Deprecations
All `.forRoot()` methods have been deprecated in favor of provider functions.

- `DbxAnalyticsSegmentModule.forRoot()` was replaced with `provideDbxAnalyticsSegmentApiService()`
- `DbxWebAngularRouterModule.forRoot()` was replaced with `provideDbxRouterWebAngularRouterProviderConfig()`
- `DbxWebUiRouterModule.forRoot()` was replaced with `provideDbxRouterWebUiRouterProviderConfig()`
- `DbxFirebaseDevelopmentModule.forRoot()` was replaced with `provideDbxFirebaseDevelopment()`. It was also added to `provideDbxFirebase()`
- `DbxFirebaseNotificationModule.forRoot()` was replaced with `provideDbxFirebaseNotifications()`. It was also added to `provideDbxFirebase()`
- `DbxMapboxModule.forRoot()` was replaced with `provideDbxMapbox()`
- `DbxStorageModule.forRoot()` was replaced with `provideDbxStorage()`
- `DbxModelInfoModule.forRoot()` was replaced with `provideDbxModelService()`
- `DbxAppAuthStateModule` was replaced with `provideDbxAppAuthState()`, `DbxAppAuthRouterModule` was replaced with `provideDbxAppAuthRouterModule()`
- `DbxAppAuthRouterStateModule` was replaced with `provideDbxAppAuthRouterStateModule()`
- `DbxAppContextStateModule` was replaced with `provideDbxAppContextState()`.

#### Angular
- Any "shared" modules, such as `DemoRootSharedModule`, need to be updated to import anything it exports. Prior these types of functions just exported, but now need an import declaration too for the same modules.

#### Breaking Changes
- `TimerInstance` has been removed in favor of `makeTimer()`. The `timer()` function has been deprecated in favor of `makeTimer()`.
- `DbxReadableErrorComponent` has been renamed to `DbxErrorComponent`.
- `DbxErrorComponent` `popoverOpen` event renamed to `popoverOpened`.
- `DbxBarButtonComponent` has been renamed to `DbxProgressBarButtonComponent`.
- `DbxSpinnerButtonComponent` has been renamed to `DbxProgressSpinnerButtonComponent`.
- `DbxAnchorLinkComponent` has been renamed to `DbxLinkComponent`.
- `AnchorType` has been renamed to `ClickableAnchorType`. and is no longer an enum.
- `dbxActionForm` has changed `dbxActionFormModified` to `dbxActionFormIsModified`, but also has added `dbxActionFormIsEqual`
- `dbxActionValueOnTrigger` has changed `dbxActionValueOnTriggerModified` to `dbxActionValueOnTriggerIsModified`, but also has added `dbxActionValueOnTriggerIsEqual`
- `dbxActionPopover` has changed `dbxActionPopoverModified` to `dbxActionPopoverIsModified`, but also has added `dbxActionPopoverIsEqual`
- `dbxActionDialog` has changed `dbxActionDialogModified` to `dbxActionDialogIsModified`, but also has added `dbxActionDialogIsEqual`