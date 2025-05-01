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
 
```Skipping migration for project demo. Unable to determine 'tsconfig.json' file in workspace config```

You might however want to use some of the angular migration tools, such as:

```npx nx g @angular/core:standalone```

This update will update all Angular files to use the new standalone configurations, but it does require the below fix to run.

The dbx-components library is unaffected by these migrations in particular. However, you can resolve the issue with the following steps describe in this issue:

https://github.com/nrwl/nx/issues/20172#issuecomment-1825783434

The command-line steps we used are as follow:

- run ```nx g @nx/plugin:plugin tools/my-plugin```. Just use the "my-plugin" name as-is, this is only temporary:
- run ```nx generate @nx/plugin:generator tools/my-plugin/src/generators/my-generator```
- copy the files from the issue/comment above
- run ```nx generate tools/my-plugin/src/generators/my-generator``` or ```npx nx generate my-generator``` (the option depends on the generator value in `generators.json`) and answer "false" to the question
- run ```npx nx migrate --run-migrations```. This may take a while depending on the size of the project.
- run ```nx generate tools/my-plugin/src/generators/my-generator``` or ```npx nx generate my-generator``` (the option depends on the generator value in `generators.json`) and answer "true" to the question to undo the generator's changes
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
- `circleci/config.yml`: Update the orbs versions:

```
  nx: nrwl/nx@1.7.0
  node: circleci/node@7.1.0
```

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

You'll have to create a `webpack.config.js` file in your app-api directory, then update the `build-base` target in `project.json` to use it under the options.

```
"options": {
  "webpackConfig": "apps/demo-api/webpack.config.js",
}
```

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

#### Polyfills.js
- Remove this file. Polyfills are now handled by the build configuration in `project.json`.

#### Angular
- Any "shared" modules, such as `DemoRootSharedModule`, need to be updated to import anything it exports. Prior these types of functions just exported, but now need an import declaration too for the same modules.

#### Updating main.ts
Previously, both `root.module.ts` and `root.firebase.module.ts` were used for configuring the app, but these have been replaced in favor of `root.app.config.ts` that uses the providers.

`main.ts` now looks like:

```
...
bootstrapApplication(UIView, appConfig)
  .catch((err) => console.error(err));
...
```

Be sure to also move `reflect-metadata` to `project.json` as one of the polyfills.

#### Breaking Changes
- `LoadingStateContextInstance` usage has been replaced with `loadingStateContext()`.
- `ListLoadingStateContextInstance` usage has been replaced with `listLoadingStateContext()`.
- `TimerInstance` has been removed in favor of `makeTimer()`. The `timer()` function has been deprecated in favor of `makeTimer()`.
- `DbxReadableErrorComponent` has been renamed to `DbxErrorComponent`.
- `DbxErrorComponent` `popoverOpen` event renamed to `popoverOpened`.
- `DbxErrorComponent` setter for error has been replaced with `setError()`.
- `DbxBarButtonComponent` has been renamed to `DbxProgressBarButtonComponent`. Added the selector `dbx-progress-bar-button` to join `dbx-bar-button`.
- `DbxSpinnerButtonComponent` has been renamed to `DbxProgressSpinnerButtonComponent`. Added the selector `dbx-progress-spinner-button` to join `dbx-spinner-button`.
- `DbxAnchorLinkComponent` has been renamed to `DbxLinkComponent`.
- `AnchorType` has been renamed to `ClickableAnchorType`. and is no longer an enum.
- `dbxActionForm` has changed `dbxActionFormModified` to `dbxActionFormIsModified`, but also has added `dbxActionFormIsEqual`
- `dbxActionValueOnTrigger` has been renamed to `dbxActionValueGetter`, and has changed `dbxActionValueOnTriggerModified` to `dbxActionValueGetterIsModified`, but also has added `dbxActionValueGetterIsEqual`
- the input `formDisabledOnWorking` has been renamed to `dbxActionFormDisabledOnWorking`
- the input `dbxActionFormValidator` has been renamed to `dbxActionFormIsValid`
- `dbxActionPopover` has changed `dbxActionPopoverModified` to `dbxActionPopoverIsModified`, but also has added `dbxActionPopoverIsEqual`
- `dbxActionDialog` has changed `dbxActionDialogModified` to `dbxActionDialogIsModified`, but also has added `dbxActionDialogIsEqual`
- `DbxPromptConfirmTypes` has been removed.
- `DbxPromptBoxComponent` has been renamed to `DbxPromptBoxDirective`, and the `elevated` input renamed to `elevate`.
- Previously `dbxActionSnackbar` could be added to a template just by calling `dbxActionSnackbar`, but it should be added using `[dbxActionSnackbar]` instead.
- `DbxListViewWrapper` has been updated to expose a readonly `currentState$`, and `loadMore` has been updated to be an `OutputRef<void>`.
- `DbxListViewWrapper` now provides `setState` and `setSelectionMode` methods instead of assigning the value via getters/setters.
- `trackBy` is no longer a variable in `AbstractDbxSelectionListViewDirective` and `AbstractDbxListViewDirective` and cannot be assigned directly. Set using `setTrackBy()` in the constructor.
- Renamed `DbxFirebaseModelTypeInstanceComponent` to `DbxFirebaseModelTypeInstanceListComponent`, as it was a list component that was improperly named.
- `DbxActionAutoTriggerDirective` has renamed `fastTrigger` to `useFastTriggerPreset` and `instantTrigger` to `useInstantTriggerPreset`.
- `DbxActionHandlerInstance` replaced setters with `setHandlerFunction` and `setHandlerValue`.
- Renamed `DbxFilterComponentParams` to `DbxFilterComponentConfig`
- Renamed `DbxFilterPopoverComponentParams` to `DbxFilterPopoverComponentConfig`
- Renamed `DbxPopoverScrollContentComponent` to `DbxPopoverScrollContentDirective`
- Renamed `DbxTwoBlockComponent` to `DbxTwoBlockDirective`
- Converted `DbxPopupWindowState` from an enum to a const object and added `DbxPopupWindowStateType`.
- Renamed `DbxFormlyFormComponent` to `DbxFormlyComponent`.
- Renamed `DbxProgressButtonOptions` to `DbxProgressButtonConfig`.
- Updated `dbx-progress-spinner-button` and `dbx-progress-bar-button` to use `[config]` instead of `[options]`.
- Renamed `DbxButtonDisplayContent` to `DbxButtonDisplay` to be inline with the `buttonDisplay` input.
- Updated inputs for `dbx-mapbox-layout`. Renamed `[opened]` to `[openDrawer]`, `[hasContent]` to `[forceHasDrawerContent]`, `(openedChange)` to `(drawerOpenedChange)`
- Renamed `displayContentObs` in `DbxChecklistItemFieldProps` (and related config) to `displayContent`.
- `valueFromLoadingState()` now returns an observable that emits `MaybeSoStrict` which always returns the value from the loading state as long as it is not null, where as prior it was equivalent to `valueFromFinishedLoadingState()`, which only returned the value if the loading state was finished loading.
- Added `currentValueFromLoadingState()`, which returns the current value from the loading state even if the loading state is still loading.
- dbxButton now has a new icon-only sizing presentation for icon-only buttons that is smaller than a fab. Previously the presentation would be equivalent to what now requires [fab]="true" configuration.
- Renamed `switchMapMaybeObs` to `switchMapFilterMaybe`.
- Removed `DbxCalendarRootModule` and replaced with `provideDbxCalendar()`.
- Renamed `DbxFormSpacerComponent` to `DbxFormSpacerDirective`.
- Renamed `DbxFormValueChangesDirective` to `DbxFormValueChangeDirective`.

#### Deprecated Components Removal
- Removed deprecated `DbxTextCompatModule`, and `dbx-notice`, `dbx-hint`, `dbx-note`, `dbx-success`, `dbx-warn`, `dbx-ok`. `dbx-label` `dbx-form-description` selectors. Use as a CSS class now.
- Removed deprecated `DbxRouteModelIdFromAuthUserIdDirective` with selector `dbxRouteModelIdFromAuthUserId`. Use `dbxRouteModelIdFromAuthUserId` instead.
- Removed deprecated `DbxFirebaseDocumentStoreRouteIdDirective` with selector `dbxFirebaseDocumentStoreRouteId`. Use `dbxRouteModelId` instead.
- Removed deprecated `DbxFirebaseDocumentStoreRouteKeyDirective` with selector `dbxFirebaseDocumentStoreRouteKey`. Use `dbxRouteModelKey` instead.

#### Updating DbxList related views
All views like this should consider being updated to standalone views. The template is still available, but now 

#### Creating private effect() calls
Some components might have private Signal effects that will raise the issue "_mySignalEffect is declared but its value is never read". It is suggested instead to create a protected effect reference instead.

Make the following changes:

Add the following rules to `.eslintrc.json`:
```
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      "args": "all",
      "argsIgnorePattern": "^_",
      "caughtErrors": "all",
      "caughtErrorsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "ignoreRestSiblings": true
    }
  ],
```

Also update `tsconfig.base.json`:

```
  "noUnusedLocals": false,
```

https://stackoverflow.com/a/76049970

#### Remove "tsConfig" from "@nx/jest:jest" configurations
The tsConfig configuration has been deprecated. When running tests you'll see the warning:

```
Option "tsConfig" is deprecated: Use the ts-jest configuration options in the jest config file instead.
```

Remove the `tsConfig` property from all `@nx/jest:jest` configurations in your application. There are other configurations where tsConfig is still used, so be careful not to remove it from those.

#### Other Errors
```
Error: Pruned lock file creation failed. The following package was not found in the root lock file
```

The fix for this issue seems to be setting `"excludeLibsInPackageJson": true` in the `build-base` target.

### Migrate to Nx 20
Nx 20 release info is here:

https://nx.dev/blog/announcing-nx-20

First run the following:

```nx migrate 20```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` for the v11 of dbxcomponents.

When performing this migration the `package.json` will attempt to be updated for Angular 19, but we need to stay on Angular 18.

https://nx.dev/nx-api/angular/documents/angular-nx-version-matrix

The latest version of Nx (v20 at time of writing) supports Angular 18.

Many of the migrations that will be generated in `migrations.json` will be for Angular 19 and will be ignored, so they can be deleted.

#### Run the migrations
- run ```npx nx migrate --run-migrations```

#### Nx Legacy Cache
There is a new cache in Nx. The legacy cache setting is added as part of the Nx 20 migration. You can disable the legacy cache by removing the `useLegacyCache` setting from the `nx.json` file.

https://nx.dev/deprecated/legacy-cache

##### New Nx Cache Error
You may encounter an error like this below:

```
 Unable to set journal_mode: DB pragma update error: SqliteFailure(Error { code: SystemIoFailure, extended_code: 522 }, Some("disk I/O error"))
```

To remedy, we just had to delete `node_modules` and rerun `npm install`.

#### Updating Nx Global Installation
You can update the global Nx installation by running:

```npm install -g nx@v20.8.0``

### Updating to gen 2 Firebase Functions
https://firebase.google.com/docs/functions/2nd-gen-upgrade

@dereekb/firebase-server functions that used Gen 1 functions are now deprecated. Because of the abstraction, updating should be straightforward. There are several updates that need to occur:

In your app (typically the dbx-components `functions.ts` file), you will need to replace:
- `onCallWithNestApplicationFactory()` with ` onCallHandlerWithNestApplicationFactory()`
- `onCallWithNestContextFactory()` with `onCallHandlerWithNestContextFactory()`
- `onScheduleWithNestApplicationFactory()` with `onScheduleHandlerWithNestApplicationFactory()`
- `onScheduleWithNestContextFactory()` with `onScheduleHandlerWithNestContextFactory()`
- `onEventWithNestContextFactory()` with `cloudEventHandlerWithNestContextFactory()`

In your tests:
- After updating the above, any `wrapV1CloudFunction()` call should be replaced with `wrapCallableRequest()` or `wrapCloudFunction()`. See below for more info.
- Replace `describeCloudFunctionTest` with `describeCallableRequestTest` for callable functions. Use `describeCloudFunctionTest` for non-callable functions.
- Replace `callCloudFunction()` with `callWrappedFunction()`, except for the above case.
- The `CloudFn` suffix for a CallableRequestTestMultipleConfig has been replaced with `WrappedFn` so if using `describeCallableRequestTest()`, update the function suffix.

You should be able to just search replace each of these.

There are some caveats though:

- If you are testing scheduled functions or other non-callable functions, you should continue to use `describeCloudFunctionTest()`, otherwise you will get an error.
- At the time of writing, some auth events, namely onCreate() for an auth user, does not have a gen 2 equivalent. Continue to use the gen 1 implementation. See more: https://firebase.google.com/docs/functions/auth-events
- The `callWrappedFunction()` result type is no longer `any`, and now returns `unknown`, so casting to the expected type will be required.

#### Firebase Functions Node 22
Update the `node` version in the `engines` section of the `package.json` to `22`, and update the functions runtime to `nodejs22`.

#### Gen 2 Cloud Functions
Gen 2 functions have additional configuration available that you'll want to configure. Cloud run is more expensive than the gen 1 implementation so it is important to change the configuration to keep costs in check. All @dereekb/firebase-server onCall/schedule/etc. configuration allows for setting default configuration created by the `onCallWithNestContextFactory`/`onScheduleWithNestContextFactory`/`onEventWithNestContextFactory` functions.

### Migrating es-lint .eslintrc.json files to eslint.config.mjs files
You can follow the migration guide here:

https://eslint.org/docs/latest/use/configure/migration-guide

You'll need to 

### Deploying to Firebase Gen 2
If you're deploying for the first time, you may need to deploy using your primary account (that should have more permissions than your service account) so that your primary/elevated permissions account can setup the cloud run functions for future deployments.

You will need to delete/remove your previous gen 1 functions, or change their name, before deploying to Gen 2.

See https://firebase.google.com/docs/functions/2nd-gen-upgrade#migrate_traffic_to_the_new_2nd_gen_functions for more information.

You will have to remove all functions and scheduled functions. Anything that says versions v1 in the Firebase console in the functions tab.

It is recommended you deploy to your staging system first with all changes before deploying to production.


## Angular Migrations
### Standalone Migrations
See the "Migrate to Nx 17 > Run The Migrations" section above for initial setup steps.

```npx nx g @angular/core:standalone```

This update will update all Angular files to use the new standalone configurations, but it does require the below fix to run.

Do the steps from the "Migrate to Nx 17 > Run The Migrations" section to prepare your project for the standalone migrations.

You will also need to change `project.json` for the components library by updating the `build-base` target's name to `build` (that is what the tool expects to be linked with `@nx/angular:package`), and update the `build` target to use the `build-temp` target temporarilly. See https://github.com/angular/angular/issues/50483#issuecomment-2419583997 for more information.

After that, you should be able to run the standalone migration as so: `npx nx g @angular/core:standalone --path=/components/demo-components`

There are three migrations steps:
1. update all components and directives
2. prune/remove unnecessary ng-modules
3. standalone bootstrap. You shouldn't need to use this as the above updates should cover this change.

You should run migration 1 first on all projects before running migration 2, as migration 2 will remove files and possibly prevent migration 1 from working properly on projects that depend on those files I.E. `demo` relying on `demo-components`.

Example:
First run: `npx nx g @angular/core:standalone --path=/components/demo-components` -> convert-to-standalone
Then run: `npx nx g @angular/core:standalone --path=/apps/demo` -> convert-to-standalone
Then run: `npx nx g @angular/core:standalone --path=/components/demo-components` -> prune ng-module
Then run: `npx nx g @angular/core:standalone --path=/apps/demo` -> prune ng-module

For the dbx-components project due to the way the imports were imported by the migration, we had to fix up the imports in the `demo-components` project.

We used the following regex to find/match all paths to `dbx-web` that were a relative import path.

Search: `(\.\.\/)+packages\/dbx-web(?:\/[\w\.-]+)+`
Replace: `@dereekb/dbx-web`

```
import { DbxLinkComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/anchor/anchor.link.component';
```

VSCode's search/replace returned us:

```
import { DbxLinkComponent } from '@dereekb/dbx-web';
```

We do the same for the remaining dbx-components imports, `dbx-core`, `dbx-form`, `dbx-firebase`, `dbx-analytics`, etc.

The linting step will clean up all the imports into a single import statement.

There may also be some left over modules that aren't removed and have leftover declarations, so just search for `declarations: ` in VSCode to find the leftover modules.

It did seem like the components that extended `AbstractDbxSelectionListWrapperDirective` did not get updated properly, so we did have to manually fix these.
