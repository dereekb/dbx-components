# dbx-components v12 to v13 upgrade info
- Update Nx to v22
- Update Angular to v21
- Move to Vitest, Removal of Jest

## Overview
This has been a big effort, and with the help of Claude, we were able to make the update in only a few days.

This update was a fairly big effort and should solidify the foundation that dbx-components is going forward.

### Angular 21
The last update from v11 to v12 we took a big step towards moving towards Zoneless. 

Since some of our dependencies still require zone.js, we will continue to use it for now, but a majority of the library supports a zoneless environment.

Luckily most of the dependencies we rely on are still being maintained or have been updated to support Angular 21.

### Removal of Jest
Jest has been a source of issues since the amount of packages using ESM have increased. During the upgrade from v11 to v12 we ran into issues with Jest's ESM imports, and on this go around there wasn't enough duct tape to fix it unfortunately. With Angular 21 officially going to Vitest, and Vitest being a solid testing framework with a very similar API to Jest, we made the move to Vitest. 

The straw that broken the camel's back was Sharp not being loaded properly in the `demo-api` tests, nor were there any other workarounds to fix it as Sharp doesn't support ESM but Jest didn't know how to import it.

Moving to Vitest appears to be worth it. Time improvements aside, we redesigned the `vitest.preset.config.mts` file to be shared by all projects. We're happy with how it turned out.

Additionally, we added `@dereekb/vitest` as a new package since matchers from the `jest-time` package are used extensively in our codebase.

### Removal Of Babel
We noticed we still had some `.babelrc` files in the codebase, but babel usage doesn't appear necessary anymore.

We updated `@dereekb/util` to use `swc` for transpiling, but the rest of the app has a reliance on `reflect-metadata`, so we still use `tsc` for building the rest of the project.

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
- `UnixDateTimeNumber` type alias removed - use `UnixDateTimeMillisecondsNumber` instead.
- `timer` constant alias removed - use `makeTimer` instead
- `filterMaybeValues` and `filterEmptyValues` aliases removed - use their non-aliased equivalents
- `BooleanStringKeyArrayUtilityInstance` alias removed
- `objectToTuples` function removed - use `Object.entries` instead
- `MimeTypeForImageTypeInputType` and `mimetypeForImageType` removed
- `PromiseAsyncTaskFn` type alias removed
- `FetchPageResults` type alias removed
- `nodeFetchService` constant alias removed. Use `fetchApiFetchService` instead.
- `filterNullAndUndefinedValues` option removed from fetch.url
- `flattenTrees` function removed - `FlattenTreeFunction` now supports arrays directly
- `PageCalculator` class and file completely removed

**BREAKING CHANGE: Date and Unix Time Types**
- `DateOrUnixDateTimeNumber` replaced with `DateOrUnixDateTimeMillisecondsNumber`
- `UnixDateTimeNumber` replaced with `UnixDateTimeMillisecondsNumber`

#### @dereekb/util/test

**BREAKING CHANGE: Test Context Builder**
- `jestTestContextBuilder` has been renamed to `testContextBuilder`
- `AbstractJestTestContextFixture
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

These values should be replaced with using `expirationDetails({ ... })` instead.

- `TimezoneString` is no longer exported. Import from `@dereekb/util` instead.

**Note:** RxJS expiration operators have been migrated to `@dereekb/rxjs/expires`. The `date/expires.rxjs` module now re-exports from the new location with deprecation notices.

#### @dereekb/rxjs

**Removed deprecated loading state aliases (18 functions):**
- `unknownLoadingStatesIsLoading` -> `isAnyLoadingStateInLoadingState`
- `allLoadingStatesHaveFinishedLoading` -> `areAllLoadingStatesFinishedLoading`
- `loadingStateIsIdle` -> `isLoadingStateInIdleState`
- `isSuccessLoadingState` -> `isLoadingStateInSuccessState`
- `isErrorLoadingState` -> `isLoadingStateInErrorState`
- `loadingStateIsLoading` -> `isLoadingStateLoading`
- `loadingStateHasFinishedLoading` -> `isLoadingStateFinishedLoading`
- `loadingStateHasError` -> `isLoadingStateWithError`
- `loadingStateHasValue` -> `isLoadingStateWithDefinedValue`
- `loadingStateHasFinishedLoadingWithValue` -> `isLoadingStateFinishedLoadingWithDefinedValue`
- `loadingStateHasFinishedLoadingWithError` -> `isLoadingStateFinishedLoadingWithError`
- `loadingStatesHaveEquivalentMetadata` -> `isPageLoadingStateMetadataEqual`
- `LoadingStateWithMaybeSoValue` -> `LoadingStateWithDefinedValue`
- `updatedStateForSetLoading` -> `mergeLoadingStateWithLoading`
- `updatedStateForSetValue` -> `mergeLoadingStateWithValue`
- `updatedStateForSetError` -> `mergeLoadingStateWithError`

**Removed deprecated properties:**
- `showLoadingOnNoValue` property from loading.context.state renamed to `showLoadingOnUndefinedValue`.
- `initialFilterTakesPriority` setter from filter.source

**Removed deprecated function aliases:**
- `listLoadingStateIsEmpty` and `isListLoadingStateEmpty`
- `switchMapMaybeObs` and `skipFirstMaybe`
- `mapPageItemIteration`

#### @dereekb/dbx-core

**BREAKING CHANGE: DbxActionDirective**
- `DbxActionDirective` no longer has the selector `dbxActionContext`. Use `dbxAction` or `dbx-action` instead.

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
- `initialFilterTakesPriority` setter from filter.abstract.source.directive. Use `setInitialFilterPriority()` instead.

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

**BREAKING CHANGE: DateFormatFromToPipe**
- Renamed the `DateFromPlusToPipe` to `DateFromToTimePipe`

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
- Removed `DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE` and replaced with `DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE`
- Removed `DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE` and replaced with `DEFAULT_DBX_LIST_GRID_VIEW_COMPONENT_CONFIGURATION_TEMPLATE`
- Removed `DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE` and replaced with `DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE`
- Renamed `dbxListGridViewDirectiveImportsAndExports` to `dbxListGridViewComponentImportsAndExports`
- Renamed `DbxListGridViewDirectiveImportsModule` to `DbxListGridViewComponentImportsModule`

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
- `dontStoreIfValue` property removed. Use `dontStoreValueIf` instead.
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
- Removed `NO_UID_ERROR_CODE`. Replaced with `DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE`
- Removed `NO_AUTH_ERROR_CODE`. Replaced with `DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE`

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

### Updating tsconfig.base.json
Now using `bundler` for `moduleResolution`. This has some ramifications, which is why we are now using Vitest instead of Jest.

#### Replacing `import * as` with `import`
For all packages, you should replace `import * as` with `import`.

For example:

```typescript
import * as _ from 'lodash';
```

Should be replaced with:

```typescript
import _ from 'lodash';
```

You may also have to update the types access.

For example:

```typescript
import * as MapboxGl from 'mapbox-gl';


export interface TypedMapboxListenerPair<T extends keyof MapboxGl.MapEventType> {
  type: T;
  listener: (ev: MapboxGl.MapEventType[T] & MapboxEventData) => void;
}
```

Should be replaced with:

```typescript
import { MapEventType } from 'mapbox-gl';

export interface TypedMapboxListenerPair<T extends keyof MapEventType> {
  type: T;
  listener: (ev: MapEventType[T] & MapboxEventData) => void;
}
```

The only place this wasn't updated was where this was being used correctly for Ngrx's reducers. declared within our app.

#### Remove `"module": "commonjs"`
You'll encounter the error "Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later." otherwise.

### Migrating to Vitest
Jest still has some issues with the ESM node environment, which caused an issue while trying to utilize a non-esm package within a test that utilized `sharp`. Unfortunately, `sharp` still has no progress towards moving to ESM, but there was a workaround, that requires the use of `mlly` and `import.meta.url`. The issue is that Jest messes with the ESM environment where `import.meta.url` is not available, which caused the workaround to fail.

Vitest does not have this issue, so `demo-api` is being migrated to use Vitest.

There is a brief migration guide here: https://vitest.dev/guide/migration.html#jest

However, there are still various problems with Angular 21 in vitest (and even jest).

#### Angular 21 Jest Updates
There's an issue with Angular 21 + Jest (https://github.com/nrwl/nx/issues/33777), so as a result, we are moving off of Jest. This requires a few changes but is mostly minimal.

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

#### Updating Angular Tests
Some tests might need to use the `waitForAsync` function call if `zone.js` is being used. This handles zone.js properly and makes sure the TestBed is properly configured. You can also remove empty arrays in the configuration. If there are no imports, you can also remove compileComponents().

All of `dbx-core` is zoneless capable. There are several libraries that are not, such as `ngx-formly`. If you are testing a form that uses `ngx-formly`, you should use the `waitForAsync` function call. If you use `waitForAsync` in the wrong context, then the tests may hang. Try removing `waitForAsync` first, and if the tests fail, then add it back. Conversly, if your tests seem to be failing randomly then try adding `waitForAsync` if it is not there.

Every test that uses TestBed and initializes a `zone.js` related element should look similar to this:

```typescript
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));
```

```typescript
  afterEach(() => {
    TestBed.resetTestingModule();
  });
```

#### Replacing jest with vi
Tests that use `jest.` should be updated to use `vi.` instead. 

For example, `jest.fn()` to `vi.fn()`.

#### Jest BeforeEach/AfterEach Hooks Note
As mentioned in the Jest->Vitest migration guide, `beforeEach` and `afterEach` hooks are called in Parallel by default. If you have any tests that rely on the order of execution of these hooks, you will need to update them to use the `sequence.hooks = 'list'` option.

The `vitest.preset.config.ts` file is already configured to use the `sequence.hooks = 'list'` option.

#### Update NestJS Injectable Decorator
- Update NestJS Injectable decorator to use `@Inject()` when injecting services.

During testing we found that if you don't use `@Inject()` when injecting services, the services won't be properly initialized as during building, the import is being seen as a "type" instead of as a "class"

I.E. At runtime it understands this:

```typescript
import { type MyService } from './my.service';

@Injectable()
export class MyClass {
  constructor(myService: MyService) {}
}

```

vs the correct:

```typescript
import { MyService } from './my.service';

@Injectable()
export class MyClass {
  constructor(myService: MyService) {}
}
```

By explicitly using `@Inject(MyService)` you ensure that the class itself is referenced instead of being stripped out during the build process.

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

#### Updating .env Files
Update all project-specific `.env` files to remove the use of `JEST_SUITE_NAME` and `JEST_JUNIT_OUTPUT_NAME` environment variables as they are no longer needed.

#### Updating tsconfig.lib.json
Update `tsconfig.lib.json` to no longer reference "jest.config.ts".

#### Updating tsconfig.spec.json
Update `tsconfig.spec.json` to reference `../../vitest.setup.typings.ts`, and remove `../../jest.setup.typings.ts` if it exists.

#### Adding @dereekb/vitest
You'll need this to replace `jest-date`.

#### Removing Jest
- Remove all the remaining jest related dependencies from `package.json`.
- Remove related setup files from the root of the project.

### ESLint Updates
- .eslintignore has been deprecated. Update project appropriately to define ignores inline.

You can update `nx.json` to remove the `.eslintignore` input from the `lint` target inputs. Additionally remove the `.eslintrc.json` if it is still there.

## Firebase Updates
- Updated to Node.js 24
- Updated to Firebase 12

No major issues in updating Firebase. The majority of the codebase changes were due to the ESM imports.

All gen 1 functions have been removed as Gen 2 is in pairity now.

### initUserOnCreate
The demo initUserOnCreate function has been updated to use the new Gen 2 blocking event api.

Before:

```typescript
import { UserRecord } from 'firebase-admin/auth';
import functions from 'firebase-functions/v1';
import { onGen1EventWithAPP_CODE_PREFIXNestContext } from '../function';

export const initUserOnCreate = onGen1EventWithAPP_CODE_PREFIXNestContext<UserRecord>((withNest) =>
  functions.auth.user().onCreate(withNest(async (request) => {
    const { nest, data } = request;
    const uid = data.uid;

    // TODO: Do something

  }))
);
```

After:

```typescript
import { type AuthBlockingEvent, beforeUserCreated } from 'firebase-functions/v2/identity';
import { blockingEventWithAPP_CODE_PREFIXNestContext } from '../function';

/**
 * Listens for users to be created and initializes them.
 */
export const initUserOnCreate = blockingEventWithAPP_CODE_PREFIXNestContext<AuthBlockingEvent, void>((withNest) =>
  beforeUserCreated(
    withNest(async (request) => {
      const { nest, data } = request;
      const uid = data?.uid;

      if (uid) {
        await nest.profileActions.initProfileForUid(uid);
      }
    })
  )
);
```

## Angular 21 Updates
- You can use replace the use of `APP_INITIALIZER` with `provideAppInitializer()`.

Example:

```typescript
provideAppInitializer(() => {
  const service = inject(DbxMapboxService);

});
```

## Updated Release Process

In v12, releases were handled by `@jscutlery/semver`. In v13, we migrated to Nx Release (see [nx-release-migration.md](nx-release-migration.md) for that initial migration). However, Nx Release's built-in conventional commit analysis has issues with our branching strategy — develop gets force-merged onto main as a single release commit, which causes `main..develop` to include the full diverged history and produce incorrect version bumps (e.g. major instead of patch).

To fix this, we now use a custom release script that combines:
- **`conventional-recommended-bump`** (from the `conventional-changelog` ecosystem) for version calculation
- **`conventional-changelog`** for changelog generation
- **Nx Release programmatic API** for applying version bumps and publishing

### How It Works

The script uses the `-dev` git tags (e.g. `v13.0.0-dev`) as the comparison anchor. These tags live on the `develop` branch and mark exactly where the last release prep happened. Commits after the `-dev` tag are what's new. The stable tag (e.g. `v13.0.0`) is used for calculating the next version number with `semver.inc()`.

The Angular preset from `conventional-changelog` determines the bump type:
- `feat:` commits → minor bump
- `fix:`, `refactor:`, `build:`, etc. → patch bump
- Breaking changes (`feat!:`, `BREAKING CHANGE:`) → major bump

### New Dependencies

Add these to `devDependencies` in `package.json`:

```json
"conventional-changelog": "^7.1.1",
"conventional-recommended-bump": "^11.2.0",
```

### Release Script

The release script is at `tools/scripts/release.mjs`. It handles the full release pipeline:

1. Finds the last stable tag and its `-dev` counterpart
2. Analyzes commits since the `-dev` tag to determine the bump type
3. Uses Nx `releaseVersion()` to bump all `package.json` files across the monorepo
4. Uses `ConventionalChangelog` to generate/update the root `CHANGELOG.md`
5. Optionally publishes via Nx `releasePublish()`

```bash
# Dry run (default) — preview the next version and changes
node tools/scripts/release.mjs

# Actual release — applies version bumps and updates CHANGELOG.md
node tools/scripts/release.mjs --dry-run=false

# Explicit version override (skips commit analysis)
node tools/scripts/release.mjs --version 13.0.1 --dry-run=false

# Verbose output
node tools/scripts/release.mjs --verbose

# Skip npm publish step
node tools/scripts/release.mjs --skip-publish
```

### nx.json Configuration

The `release` block in `nx.json` is still used by the Nx Release programmatic API for version bumping. Key changes from the initial migration:

- **`release.git`** has been split into **`release.version.git`** and **`release.changelog.git`** — the Nx programmatic API requires this separation
- **`release.version.git`** has `commit`, `tag`, and `stageChanges` all set to `false` since the script handles versioning only; git operations are done separately by the release workflow
- **`release.changelog`** config is retained but the script generates the root changelog directly with `conventional-changelog` instead of using Nx's changelog generation, which avoids the same history traversal issue
- **Per-project changelogs** (`projectChangelogs`) have been removed — only the root `CHANGELOG.md` is maintained

### Workspace project.json Targets

The release targets in the root `project.json` now use the custom script:

```json
"release-dry-run": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node tools/scripts/release.mjs --skip-publish --verbose"
  }
},
"release": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node tools/scripts/release.mjs --dry-run=false --skip-publish --verbose"
  }
}
```

Run them with:

```bash
npx nx release-dry-run    # preview
npx nx release            # apply changes
```

### Per-Package CHANGELOG.md Files Removed

Per-package `CHANGELOG.md` files under `packages/` have been deleted. Only the root `CHANGELOG.md` is maintained going forward. This simplifies the release process and avoids the history traversal issues that caused incorrect changelogs in sub-packages.
