# dbx-components v12 to v13 upgrade info
- Update Nx to v22
- Update Angular to v21

## Migrations
We are jumping from Nx version 20 to version 22. It is important to run two independent migrations to ensure everything gets up to date properly.

### Migrate to Nx 22
Nx 22 release info is here:

https://nx.dev/blog/nx-22-release

First run the following:

```nx migrate 22```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` for the v12 of dbxcomponents.

#### Run the migrations
- run ```npx nx migrate --run-migrations```. No errors were encountered while upgrading.

After migrating, you can run ```nx reset``` to reset the workspace's cache if you encounter issues with building.

#### Nx Agent Skills
You might find it useful to install the nx skills here if you are using AI agents like Claude:

https://nx.dev/blog/nx-ai-agent-skills

### Updating Packages
Check the updated `package.json` for more info.

#### Angular
- Updated to v21.0.0
- This update will NOT go with full zoneless due to some dependencies not supporting zoneless yet.

#### Ngx Formly
- At the time of writing, the update to v7.1.0 isn't compatable with angular 21.
- Additionally, there is an error within the material package:

```
✘ [ERROR] No matching export in "node_modules/@angular/material/fesm2022/core.mjs" for import "MatCommonModule"
    node_modules/@ngx-formly/material/fesm2022/ngx-formly-material-slider.mjs:11:9:
      11 │ import { MatCommonModule, MatRippleModule } from '@angular/materia...
```

- We built a custom version/branch that can be used instead.

#### @ng-web-apis/geolocation
- GeolocationService was renamed to WaGeolocationService

#### @bobbyquantum/ngx-editor
- Replaced `ngx-editor` with `@bobbyquantum/ngx-editor`, as the original package is no longer maintained. See https://github.com/bobbyquantum/ngx-editor

#### @angular/fire
At the time of writing, @angular/fire still hasn't had an Angular 21 update, possibly due to rxfire not being updated yet. We created a special branch on dereekb/rxfire that has the Angular 21 update. We will use that until the official package is updated.

You'll need to specify the following overrides in `package.json`:

```json
"overrides": {
  "@angular/fire": {
    "rxfire": "git+https://git@github.com/dereekb/rxfire#606da27059f8fce2563d6e5a79ec4c7d0843a942",
    "firebase-tools": "15.7.0"
  }
}
```

#### date-fns
- Updated to v4.1.0
- `date-fns-tz` supports date-fns v4, so we don't need to update it yet.
- In the future, we will also remove `date-fns-tz` and replace it with `date-fns/tz`.

#### ngx-mat-input-tel
- Replaced `ngx-mat-intl-tel-input` with `ngx-mat-input-tel`, as someone else has forked the original package and updated it for Angular 21 with additional improvements.

#### @jscutlery/semver
- Removed. Will be using Nx Release tools from now on since Nx has updating release tooling.
- See https://nx.dev/docs/features/manage-releases for more info
- You can use the [nx-release-migration.md](nx-release-migration.md) file to help you migrate.

### Breaking Changes and Removing Deprecated Code

#### @dereekb/util

**Removed deprecated type aliases and functions:**
- `UnixTimeNumber` type alias removed - use `UnixDateTimeNumber` instead
- `timer` constant alias removed - use `makeTimer` instead
- `filterMaybeValues` and `filterEmptyValues` aliases removed - use their non-aliased equivalents
- `BooleanStringKeyArrayUtilityInstance` alias removed
- `objectToTuples` function removed - use `Object.entries` instead
- `MimeTypeForImageTypeInputType` and `mimetypeForImageType` removed
- `PromiseAsyncTaskFn` type alias removed
- `FetchPageResults` type alias removed
- `nodeFetchService` constant alias removed
- `filterNullAndUndefinedValues` option removed from fetch.url
- `flattenTrees` function removed - `FlattenTreeFunction` now supports arrays directly
- `PageCalculator` class and file completely removed

**BREAKING CHANGE: Date and Unix Time Types**
- `DateOrUnixDateTimeNumber` replaced with `DateOrUnixDateTimeMillisecondsNumber`
- `UnixDateTimeMillisecondsNumber` replaced with `UnixDateTimeNumber`

#### @dereekb/util/test

**BREAKING CHANGE: Test Context Builder**
- `jestTestContextBuilder` has been renamed to `testContextBuilder`
- `AbstractJestTestContextFixture` has been renamed to `AbstractTestContextFixture`
- `AbstractChildJestTestContextFixture` has been renamed to `AbstractChildTestContextFixture`
- `JestTestContextFactory` has been renamed to `TestContextFactory`

#### @dereekb/date

**Removed DST-unsafe deprecated functions:**
- `takeNextUpcomingTime`
- `copyHoursAndMinutesFromDateToToday`
- `copyHoursAndMinutesFromNow`
- `copyHoursAndMinutesFromDate`

**Removed deprecated formatting aliases:**
- `toISO8601DayString`
- `formatToISO8601DayString`
- `dateShortDateStringFormat`

**Removed expires functions (moved to @dereekb/rxjs):**
- `atleastOneNotExpired`
- `anyHaveExpired`
- `timeHasExpired`
- `toExpires`
- `hasExpired`
- `getExpiration`

**Note:** RxJS expiration operators have been migrated to `@dereekb/rxjs/expires`. The `date/expires.rxjs` module now re-exports from the new location with deprecation notices.

#### @dereekb/rxjs

**Removed deprecated loading state aliases (18 functions):**
- `unknownLoadingStatesIsLoading`
- `allLoadingStatesHaveFinishedLoading`
- `loadingStateIsIdle`
- `isSuccessLoadingState`
- `isErrorLoadingState`
- `loadingStateIsLoading`
- `loadingStateHasFinishedLoading`
- `loadingStateHasError`
- `loadingStateHasValue`
- `loadingStateHasFinishedLoadingWithValue`
- `loadingStateHasFinishedLoadingWithError`
- `loadingStatesHaveEquivalentMetadata`
- `LoadingStateWithMaybeSoValue`
- `updatedStateForSetLoading`
- `updatedStateForSetValue`
- `updatedStateForSetError`

**Removed deprecated properties:**
- `showLoadingOnNoValue` property from loading.context.state
- `initialFilterTakesPriority` setter from filter.source

**Removed deprecated function aliases:**
- `listLoadingStateIsEmpty` and `isListLoadingStateEmpty`
- `switchMapMaybeObs` and `skipFirstMaybe`
- `mapPageItemIteration`

#### @dereekb/dbx-core

**Deleted 10 deprecated NgModule files:**
- `auth/auth.module.ts`
- `context/context.module.ts`
- `injection/injection.component.module.ts`
- `pipe/async/async.pipe.module.ts`
- `pipe/date/date.pipe.module.ts`
- `pipe/misc/misc.pipe.module.ts`
- `pipe/pipe.module.ts`
- `pipe/value/value.pipe.module.ts`
- `router/model/model.module.ts`
- `router/router/provider/uirouter/uirouter.router.service.module.ts`

**Removed deprecated directive classes:**
- `AbstractSubscriptionDirective` from rxjs/rxjs.directive
- `AbstractLockSetSubscriptionDirective` from rxjs/rxjs.directive

**Removed deprecated properties:**
- `initialFilterTakesPriority` setter from filter.abstract.source.directive

### @dereekb/nestjs/mailgun

The `NotificationMessageEntityKeyRecipientLookup` type was unintentionally created/exported from `@dereekb/firebase-server`, but was needed in the `@dereekb/nestjs/mailgun` package. It has been renamed and moved.

**BREAKING CHANGE: MailgunRecipientBatchSendTargetEntityKeyRecipientLookup**
- `NotificationMessageEntityKeyRecipientLookup` type has been renamed to `MailgunRecipientBatchSendTargetEntityKeyRecipientLookup`
- `notificationMessageEntityKeyRecipientLookup` function has been renamed to `mailgunRecipientBatchSendTargetEntityKeyRecipientLookup`

#### @dereekb/dbx-web

**Deleted 11 deprecated NgModule files:**
- `calendar/calendar.module.ts`
- `action/transition/action.transition.module.ts`
- `extension/download/text/download.text.module.ts`
- `extension/widget/widget.module.ts`
- `keypress/keypress.module.ts`
- `layout/block/block.layout.module.ts`
- `layout/list/list.layout.module.ts`
- `router/layout/anchorlist/anchorlist.module.ts`
- `router/layout/list/list.module.ts`
- `router/layout/navbar/navbar.module.ts`

**BREAKING CHANGE: DbxSetStyleDirective**
- Now has a new mode - by default sets style to self (not global/body)
- Use the new mode parameter to control where styles are applied

**BREAKING CHANGE: Color system changes**
- Renamed `dbx-bg` to `dbx-default`
- Removed `dbx-bg` color
- Added `--dbx-color-bg` and `--dbx-color` CSS variables

**Removed deprecated code:**
- `deprecated.table.reader.cached.ts` file deleted
- Deprecated inputs from `keydown.listener.directive.ts`: `appWindowKeyDownEnabled`, `appWindowKeyDownFilter`
- Deprecated aliases from `mapbox.store.ts`: `content$`, `hasContent$`, `clearContent`, `setContent`
- Deprecated template constants and `deprecatedInputState$` from list directives

#### @dereekb/dbx-form

**Deleted 8 deprecated NgModule files:**
- `form/action/form.action.module.ts`
- `form/action/transition/form.action.transition.module.ts`
- `form/io/form.io.module.ts`
- `formly/field/selection/selection.module.ts`
- `formly/field/value/value.module.ts`
- `formly/form/form.form.module.ts`
- `formly/formly.module.ts`
- `layout/form.layout.module.ts`

**BREAKING CHANGE: Material Slider**
- Angular Material changed the `thumbLabel` property to `discrete`
- Update all slider configurations to use the new property name

#### @dereekb/firebase

**Removed deprecated constants and types:**
- `notificationTemplateTypeDetailsRecord` constant
- `StorageFileProcessingNotificationTaskCheckpoint` type and related constants
- Typo function: `filterDisallowedFirestoreItemPageIteratorInputContraints`
- `dontStoreIfValue` property (deprecated)
- `StorageFileProcessingNotificationTaskCheckpoint` replaced with  `NotificationTaskSubtaskCheckpoint`
- `STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_CHECKPOINT_PROCESSING` replaced with `NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING`
- `STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_CHECKPOINT_CLEANUP` replaced with `NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP`

#### @dereekb/firebase-server

**BREAKING CHANGE: Firebase Functions v1 removed**
- Deleted all Firebase Functions v1 files:
  - `nest/function/v1/call.ts`
  - `nest/function/v1/event.ts`
  - `nest/function/v1/schedule.ts`
- All code must now use Firebase Functions v2

**Completed purpose→target migration:**
- Removed deprecated `purpose` property from `StorageFileProcessingPurposeSubtaskInput`
- Use `target` property instead

**Removed deprecated constants and properties:**
- Typo constant: `FIRESTBASE_SERVER_VALIDATION_ERROR_CODE`
- Deprecated `crud` property removed

#### @dereekb/dbx-firebase

**Deleted 11 deprecated NgModule files:**
- `auth/firebase.auth.module.ts`
- `auth/login/firebase.login.module.ts`
- `firebase/firebase.emulator.module.ts`
- `firebase/firebase.module.ts`
- `firestore/firebase.firestore.module.ts`
- `function/firebase.function.module.ts`
- `model/model.types.module.ts`
- `model/modules/model/history/model.history.module.ts`
- `modules/notification/notification.module.ts`
- `pipe/pipe.module.ts`
- `storage/firebase.storage.module.ts`

**Removed deprecated types:**
- `DbxFirebaseOptions` type removed

### Updating circleci.yaml
Update the `openjdk` version to `21` in the `config.yml` file.

Replace:

```yaml
      - run: sudo apt-get update -y && sudo apt-get install -y curl openjdk-11-jre-headless
```

With:

```yaml
      - run: sudo apt-get update -y && sudo apt-get install -y curl openjdk-21-jre-headless
```

### Migrating (Partially) to Vitest
Jest still has some issues with the ESM node environment, which caused an issue while trying to utilize a non-esm package within a test that utilized `sharp`. Unfortunately, `sharp` still has no progress towards moving to ESM, but there was a workaround, that requires the use of `mlly` and `import.meta.url`. The issue is that Jest messes with the ESM environment where `import.meta.url` is not available, which caused the workaround to fail.

Vitest does not have this issue, so `demo-api` is being migrated to use Vitest.

There is a brief migration guide here: https://vitest.dev/guide/migration.html#jest

However, there are still various problems with Angular 21 in vitest (and even jest).

#### Angular 21 Jest Updates
There's an issue with Angular 21 + Jest: 

https://github.com/nrwl/nx/issues/33777

The workaround requires two changes:
Update `jest.preset.ts` to make sure that `jest-preset-angular` uses the ESM preset:

```typescript
transform = {
      '^.+\\.(ts|js|mjs|html|svg)$': ['jest-preset-angular', { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$', useESM: true }]
    };
```

Update `jest.setup.angular.ts` to use the following:

```typescript
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone/index.mjs';

setupZoneTestEnv();
```

Additionally, you'll have to add the following to the `compilerOptions` in each .spec.ts file:

```json
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
```

#### Install Vitest
Run `nx add @nx/vitest` to add Vitest to the project.

Optionally update the following dependencies:

```
"@swc-node/register": "1.11.1",
"@swc/cli": "0.8.0",
"@swc/core": "1.15.13",
"@swc/helpers": "0.5.19",
```

#### Update Project Configuration
Use the nx generator for configuring vitest. The previous `project.json` file had a `run-tests` target that ran the tests. Before running the generator, remove the `run-tests` target.

Example for demo-api:

```
    "run-tests": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/apps/demo-api", "{projectRoot}/.reports/junit/demo-api.junit.xml"],
      "options": {
        "jestConfig": "apps/demo-api/jest.config.ts"
      }
    },
```

Now run `nx g @nx/vitest:configuration --project=demo-api --testEnvironment=node --testTarget=run-tests` to add Vitest to the project.

#### util-test changes
With the addition of Vitest, the `util-test` package has been updated to support Vitest. Since vitest and jest are similar, the utilities are mostly the same. The Jest prefix has been removed however.

#### Removal of done callback tests
Vitest does not support the `done` callback in tests. If you have any tests that use the `done` callback, you will need to remove it and use the promise-based approach instead.

You can use the `convert-callback-tests.js` script in the root of your project to convert your tests. 

Run it with the `--dry-run` flag to see what changes would be made.

#### Removal of jest.setTimeout

Remove all instances of `jest.setTimeout(30000);` from your test files. Instead, add a `testTimeout` property to the `createVitestConfig` function in your `vitest.config.mts` file.

#### Replacing jest with vi
Tests that use `jest.` should be updated to use `vi.` instead. 

For example, `jest.fn()` to `vi.fn()`.

#### Updating nx.json

Update `nx.json` to use the new `test` target configuration. Example:

```json
"test": {
      "dependsOn": ["build"],
      "inputs": ["default", "^default", "{workspaceRoot}/jest.preset.ts", "{workspaceRoot}/vitest.preset.config.mts", "{workspaceRoot}/vitest.setup.*.ts"],
      "outputs": ["{projectRoot}/.reports/vitest/{projectName}.junit.xml"],
      "cache": true
    }
```

You can remove the jest preset from `nx.json` after jest is removed entirely.
