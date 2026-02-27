# 13.0.0 (2026-02-27)

### 🚀 Features

- ⚠️  dbx-components v13 ([#33](https://github.com/dereekb/dbx-components/pull/33))
- added StorageFileGroup ([#31](https://github.com/dereekb/dbx-components/pull/31))
- added StorageFile ([#30](https://github.com/dereekb/dbx-components/pull/30))
- angular 18 ([#28](https://github.com/dereekb/dbx-components/pull/28))
- notifications ([#27](https://github.com/dereekb/dbx-components/pull/27))
- nx16 and Angular 16 migration ([#25](https://github.com/dereekb/dbx-components/pull/25))
- dbx-table ([#23](https://github.com/dereekb/dbx-components/pull/23))
- added DbxFirebaseModelTypesService ([d711abba](https://github.com/dereekb/dbx-components/commit/d711abba))
- added DbxPresetMenuFilter ([2c08ad79](https://github.com/dereekb/dbx-components/commit/2c08ad79))
- added redirectForUserIdentifierParamHook ([0f8467d9](https://github.com/dereekb/dbx-components/commit/0f8467d9))
- updated to angular 14 ([#15](https://github.com/dereekb/dbx-components/pull/15))
- added DbxWidgetViewComponent ([6cf8d3a7](https://github.com/dereekb/dbx-components/commit/6cf8d3a7))
- added firestore key validators ([9d090db1](https://github.com/dereekb/dbx-components/commit/9d090db1))
- added DbxFirebaseDocumentLoaderInstance ([523d1dff](https://github.com/dereekb/dbx-components/commit/523d1dff))
- added DbxRouteParamDefaultInstance ([26085806](https://github.com/dereekb/dbx-components/commit/26085806))
- added DbxRouteParamReader ([a8552835](https://github.com/dereekb/dbx-components/commit/a8552835))
- added jest fail test utilities ([#13](https://github.com/dereekb/dbx-components/pull/13))
- added FirestoreMap, FirestoreArrayMap snapshot fields ([bd23fd37](https://github.com/dereekb/dbx-components/commit/bd23fd37))
- setup project ([fe2ae885](https://github.com/dereekb/dbx-components/commit/fe2ae885))
- added dbxFirebaseCollectionChangeDirective ([93a38a2b](https://github.com/dereekb/dbx-components/commit/93a38a2b))
- firebaseServerAuthModule ([db9a4d3d](https://github.com/dereekb/dbx-components/commit/db9a4d3d))
- added dbxFirebaseDocumentWithParentStore ([f055d81a](https://github.com/dereekb/dbx-components/commit/f055d81a))
- added dbxFirebaseDocumentStore ([43da785b](https://github.com/dereekb/dbx-components/commit/43da785b))
- added dbxFirebaseCollectionStore ([9704c836](https://github.com/dereekb/dbx-components/commit/9704c836))
- added dbxAppContextStateModule, dbxAppAuthRouterModule ([40fa1fe9](https://github.com/dereekb/dbx-components/commit/40fa1fe9))
- added dbxAppContextState ([dfc17ebf](https://github.com/dereekb/dbx-components/commit/dfc17ebf))
- added dbxProgressButtons ([004ada21](https://github.com/dereekb/dbx-components/commit/004ada21))
- added dbxCoreAuthModule ([29ebf14b](https://github.com/dereekb/dbx-components/commit/29ebf14b))
- added dbxAuthService ([9422182a](https://github.com/dereekb/dbx-components/commit/9422182a))
- dbxActionDialogDirective ([63fb8717](https://github.com/dereekb/dbx-components/commit/63fb8717))
- dbxActionPopoverDirective ([a808ac9a](https://github.com/dereekb/dbx-components/commit/a808ac9a))
- added dbxActionEnforceModified ([5a4c4b26](https://github.com/dereekb/dbx-components/commit/5a4c4b26))
- added dbxActionLoadingContextDirective ([c20aa028](https://github.com/dereekb/dbx-components/commit/c20aa028))

### 🩹 Fixes

- fix unintentional deprecated variable renaming ([5f28f51e](https://github.com/dereekb/dbx-components/commit/5f28f51e))
- fixed ClickableFilterPreset type ([5bab6db5](https://github.com/dereekb/dbx-components/commit/5bab6db5))
- fixed mapbox fields marked issue ([04e6e3a5](https://github.com/dereekb/dbx-components/commit/04e6e3a5))
- fixed dbxFormSourceObservable() emission ([cf927b43](https://github.com/dereekb/dbx-components/commit/cf927b43))
- fixed redirectForUserIdentifierParamHook() ([1be07a3e](https://github.com/dereekb/dbx-components/commit/1be07a3e))
- added error handling to DbxFirebaseAuthService authUserState ([206132f2](https://github.com/dereekb/dbx-components/commit/206132f2))
- fixed isLatestSuccessfulRoute() initial value ([fbde9194](https://github.com/dereekb/dbx-components/commit/fbde9194))
- hasAuthRoleHook fix ([e4749bae](https://github.com/dereekb/dbx-components/commit/e4749bae))
- hasAuthStateData interface fix ([8ea59e3c](https://github.com/dereekb/dbx-components/commit/8ea59e3c))
- fixed dbxActionEnforceModifiedDirective ([f889b874](https://github.com/dereekb/dbx-components/commit/f889b874))
- fixed createOrUpdateWithAccessor ([243d0d3d](https://github.com/dereekb/dbx-components/commit/243d0d3d))
- dbx-web, dbx-form now export scss in package.json ([c7f7c148](https://github.com/dereekb/dbx-components/commit/c7f7c148))

### ⚠️  Breaking Changes

- dbx-components v13  ([#33](https://github.com/dereekb/dbx-components/pull/33))
  DbxSetStyleDirective now has a new mode. By default sets to self.
  - BREAKING CHANGE: removed dbx-bg
  * refactor: removed unused standalone imports
  - resolved angular NG8113 warnings about unused standalone imports
  * refactor: updated use of dbxColor within dbx-button
  - dbx-button now uses dbxColor to color each button
  * refactor: updated progress buttons
  - BREAKING CHANGE: remove deprecated options from DbxProgressButtonConfig
  * refactor: type fixes
  - updated ng-overlay-container version
  * refactor: removed DateOrUnixDateTimeNumber compat
  - BREAKING CHANGE: Replace DateOrUnixDateTimeNumber with DateOrUnixDateTimeMillisecondsNumber
  - BREAKING CHANGE: Replace UnixDateTimeMillisecondsNumber with UnixDateTimeNumber
  * refactor: fixed material slider property change
  - Fixed issue where Angular Material changed the property name of thumbLabel to discrete
  * refactor: removed @dereekb/util deprecated/compat code
  Removed deprecated type aliases, function aliases, and compat code across the util package:
  - date/date.unix.ts: Removed UnixTimeNumber and related deprecated function aliases
  - date/time.ts: Removed timer constant alias (use makeTimer instead)
  - array/array.value.ts: Removed filterMaybeValues and filterEmptyValues aliases
  - array/array.boolean.ts: Removed BooleanStringKeyArrayUtilityInstance alias
  - object/object.map.ts: Removed objectToTuples function (use Object.entries)
  - string/mimetype.ts: Removed MimeTypeForImageTypeInputType and mimetypeForImageType
  - promise/promise.ts: Removed PromiseAsyncTaskFn type alias
  - fetch/fetch.page.ts: Removed FetchPageResults type alias
  - fetch/provider.ts: Removed nodeFetchService constant alias
  - fetch/fetch.url.ts: Removed deprecated filterNullAndUndefinedValues option
  - tree/tree.flatten.ts: Removed flattenTrees function (FlattenTreeFunction now supports arrays)
  - tree/tree.array.ts: Updated to use FlattenTreeFunction directly with arrays
  - page/page.calculator.ts: Deleted entire file (fully deprecated PageCalculator class)
  - page/index.ts: Removed export of deleted PageCalculator
  * refactor: moved expires operators to rxjs
  - date/date.ts: Removed 4 DST-unsafe deprecated functions (takeNextUpcomingTime, copyHoursAndMinutesFromDateToToday, copyHoursAndMinutesFromNow, copyHoursAndMinutesFromDate)
  - expires/expires.ts: Removed COMPAT section with 6 deprecated functions (atleastOneNotExpired, anyHaveExpired, timeHasExpired, toExpires, hasExpired, getExpiration)
  - date/date.format.ts: Removed deprecated formatting aliases (toISO8601DayString, formatToISO8601DayString, dateShortDateStringFormat)
  - date/date.time.limit.ts: Updated to use non-deprecated functions
  - loading/loading.state.ts: Removed COMPAT section with 18 deprecated aliases (unknownLoadingStatesIsLoading, allLoadingStatesHaveFinishedLoading, loadingStateIsIdle, isSuccessLoadingState, isErrorLoadingState, loadingStateIsLoading, loadingStateHasFinishedLoading, loadingStateHasError, loadingStateHasValue, loadingStateHasFinishedLoadingWithValue, loadingStateHasFinishedLoadingWithError, loadingStatesHaveEquivalentMetadata, LoadingStateWithMaybeSoValue, updatedStateForSetLoading, updatedStateForSetValue, updatedStateForSetError)
  - loading/loading.context.state.ts: Removed deprecated showLoadingOnNoValue property
  - loading/loading.state.list.ts: Removed listLoadingStateIsEmpty and isListLoadingStateEmpty aliases
  - rxjs/value.ts: Removed switchMapMaybeObs and skipFirstMaybe aliases
  - filter/filter.source.ts: Removed initialFilterTakesPriority setter
  - iterator/iteration.mapped.page.ts: Removed mapPageItemIteration alias
  - Updated internal usage and tests to use new function names
  Migrated RxJS expiration operators to @dereekb/rxjs:
  - Created rxjs/expires.ts with 6 operators reimplemented using expirationDetails()
  - Added comprehensive test coverage (10 tests, all passing)
  - Updated date/expires.rxjs.ts to re-export from @dereekb/rxjs with deprecation notice
  * refactor: updated phone picker
  - used ngx-mat-intl-tel-input as the phone input replacement
  * refactor: removed deprecated utilities from dbx-core
  - Deleted 10 deprecated NgModule files (pipe modules, context module, injection module, router modules, auth module)
  - Removed 2 deprecated directive classes from rxjs/rxjs.directive.ts (AbstractSubscriptionDirective, AbstractLockSetSubscriptionDirective)
  - Removed deprecated initialFilterTakesPriority setter from filter.abstract.source.directive.ts
  - Updated all barrel exports and test files to use standalone components directly
  * refactor: remove deprecated dbx-web/dbx-form code
  @dereekb/dbx-web:
  - Deleted 11 deprecated NgModule files
  - Removed deprecated inputs from keydown.listener.directive.ts (appWindowKeyDownEnabled, appWindowKeyDownFilter)
  - Removed deprecated aliases from mapbox.store.ts (content$, hasContent$, clearContent, setContent)
  - Deleted deprecated.table.reader.cached.ts
  - Removed deprecated template constants and deprecatedInputState$ from list directives
  - Updated all barrel exports
  @dereekb/dbx-form:
  - Deleted 8 deprecated NgModule files
  - Updated formly.providers.ts to import individual field modules
  - Updated all barrel exports
  - Fixed consumer code in demo app and demo-components to use new APIs
  - Updated templates to use non-deprecated inputs
  * refactor: removed deprecated firebase/dbx-firebase code
  @dereekb/firebase:
  - Removed notificationTemplateTypeDetailsRecord constant
  - Removed StorageFileProcessingNotificationTaskCheckpoint type and related constants
  - Removed typo function filterDisallowedFirestoreItemPageIteratorInputContraints
  - Removed deprecated dontStoreIfValue property
  @dereekb/dbx-firebase:
  - Deleted 11 deprecated NgModule files
  - Removed deprecated DbxFirebaseOptions type
  - Updated all barrel exports
  @dereekb/firebase-server:
  - Completed purpose→target migration in storagefile.task.service.handler.ts
  - Removed deprecated purpose property from StorageFileProcessingPurposeSubtaskInput
  - Removed typo constant FIRESTBASE_SERVER_VALIDATION_ERROR_CODE
  - Removed deprecated crud property
  - Deleted Firebase Functions v1 files (event.ts, call.ts, schedule.ts)
  - Updated code to use Firebase Functions v2 only
  * refactor: updated node version
  - updated circleci and minimum node versions
  - removed deprecated firebase v1 functions
  * refactor: fixed HashSet's set implementation types
  - added deprecation details to v12-to-v13-upgrade-info.md
  * refactor: test fixes
  - updated AuthBlockingEvent and initUserOnCreate section
  * checkpoint: sharp testing
  * refactor: added vitest utils to util-test
  * refactor: updated util-test exported classes
  - removed Jest prefix from new exported classes/etc.
  * checkpoint: vitest
  * checkpoint: renamed expectFailAssertErrorType
  - renamed jestExpectFailAssertErrorType to expectFailAssertErrorType, and deprecated jestExpectFailAssertErrorType
  * refactor: convert callback tests for vitest
  - vitest removes the usage of using the done callback for tests. All tests updates to reflect this change, and
  - added convert-callback-tests.js utility
  - updated v12-to-v13 upgrade info documentation
  * refactor: dbx-firebase test runner fix
  - updated openjdk-21-jre-headless for firebase tests
  * checkpoint: updated @dereekb/util to use vitest
  * checkpoint: added @dereekb/vitest library
  * refactor: updated @dereekb/util tests
  - all tests pass now running vitest
  * refactor: added migrate-to-vitest script
  * refactor: added @dereekb/vitest to publishing
  - @dereekb/vitest is now being setup properly within the app (removed inline declarations from @dereekb/util tests
  - updated @dereekb/date to use vitest
  * refactor: test fixes
  - updated jest output paths to be /junit instead of /jest
  * refactor: updated @dereekb/nestjs to use vitest
  * refactor: updated @dereekb/rxjs and @dereekb/model to vitest
  * refactor: updated @dereekb/firebase to use vitest
  * refactor: @dereekb/firebase test fix
  - test files currently must be run sequentially. Concurrent running of tests will cause some weird issues to occur and the tests to fail.
  * refactor: createVitestConfig() update
  * refactor: updated @dereekb/firebase-server to use vitest
  * refactor: fixed @dereekb/firebase/test test
  * refactor: updated @dereekb/dbx-core to use vitest
  * refactor: updated @dereekb/dbx-web to use vitest
  * refactor: update @dereekb/dbx-web to use vitest
  - fixed bad test in @dereekb/date
  - added tests to @dereekb/dbx-web/mapbox, @dereekb/dbx-web/calendar, and @dereekb/dbx-web/table
  - Updated vitest.setup.angular setup/usage.
  * refactor: updated @dereekb/dbx-form to use vitest
  * refactor: updated @dereekb/dbx-firebase to use vitest
  - updated @dereekb/dbx-firebase tests
  - removed redundant "strict" from tsconfigs
  * refactor: updated angular test handling
  - updated angular test setup/cleanup
  * refactor: update demo-api to use vitest
  * refactor: update demo to use vitest
  * refactor: updated remaining projects to vitest
  * checkpoint: removed jest from project
  * checkpoint: removed jest from project
  * refactor: updated eslint, ran linter
  * refactor: demo-api test fix
  - fixed removed test folder, and updated tsconfig.app.json to ignore test folder
  * refactor: test fixes
  - fixed regression where waitForAsync() was causing the tests to fail
  * refactor: updated date tests
  - date's vitest tests now run in parallel
  - removed use of mocktest since it is available in vitest natively
  * refactor: setup-project.sh fix
  * refactor: date test fixes
  1. date.week.ts — Double timezone conversion in yearWeekCodeForDateRangeFactory
  The range factory called _normal.systemDateToTargetDate() on dates, then passed them to factory() which called systemDateToTargetDate() again. With UTC+14 the double shift crossed a day boundary, moving Dec 26 (week 1) back to Dec 25 (week 52). Fixed by using yearWeekCodePairFromDate() directly on the already-converted dates.
  2. date.cell.schedule.ts — System-timezone-dependent startOfDay in dateCellScheduleDateRange
  When start was absent but startsAt was present, the function passed the Date directly to startOfDayInTargetTimezone(), which uses system-local startOfDay() internally. With UTC+14 this computed the wrong calendar day. Fixed by converting to an ISO day string first (via baseDateToTargetDate + formatToISO8601DayStringForUTC), matching how dateCellTiming handles the same computation.
  * refactor: date timezone fix
  - fixed issue where it was assumed that DST starts at the same time globally. It does not. Dublin starts on a different day than America...
  * fix: make DST tests timezone-agnostic
  Previously the DST tests hardcoded Nov 3 2024 (US fall-back date), causing
  failures in Europe/Dublin where fall-back is Oct 27. Now both spring-forward
  and fall-back dates are discovered dynamically, and spring-forward tests are
  added to verify roundDateToUnixDateTimeNumber and document erroneous set()/
  setHours() behavior near the DST gap.
  Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
  * refactor: build configuration improvements
  - removed redundant configurations from child tsconfig.*.json files in project
  - added "buildLibsFromSource": false to "@nx/rollup:rollup" configuration in nx.json. This should help improve build times.
  - updated setup-project.sh
  * refactor: build fix
  - changed date parallel test running config as circleci is still hanging on some long running tests
  * refactor: updated firebase config
  * refactor: styling fix
  * checkpoint: build fix
  * refactor: updated subprojects to use rollup
  - some projects were not outputting properly, causing builds to fail
  - some projects were not using rollup. Previously they only emitted commonjs, but now can emit esm
  * checkpoint: build output fixes
  * checkpoint: rollup improvements
  * checkpoint: added rollup stats, updated builds
  - added rollup to various packages to export both ESM and CommonJS

# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

# [12.7.0](https://github.com/dereekb/dbx-components/compare/v12.6.21-dev...v12.7.0) (2026-02-20)



## [12.6.21](https://github.com/dereekb/dbx-components/compare/v12.6.20-dev...v12.6.21) (2026-02-18)



## [12.6.20](https://github.com/dereekb/dbx-components/compare/v12.6.19-dev...v12.6.20) (2026-02-15)



## [12.6.19](https://github.com/dereekb/dbx-components/compare/v12.6.18-dev...v12.6.19) (2026-02-13)



## [12.6.18](https://github.com/dereekb/dbx-components/compare/v12.6.17-dev...v12.6.18) (2026-02-10)



## [12.6.17](https://github.com/dereekb/dbx-components/compare/v12.6.16-dev...v12.6.17) (2026-02-09)



## [12.6.16](https://github.com/dereekb/dbx-components/compare/v12.6.15-dev...v12.6.16) (2026-02-08)



## [12.6.15](https://github.com/dereekb/dbx-components/compare/v12.6.14-dev...v12.6.15) (2026-02-07)



## [12.6.14](https://github.com/dereekb/dbx-components/compare/v12.6.13-dev...v12.6.14) (2026-02-06)



## [12.6.13](https://github.com/dereekb/dbx-components/compare/v12.6.12-dev...v12.6.13) (2026-02-06)



## [12.6.12](https://github.com/dereekb/dbx-components/compare/v12.6.10-dev-dev...v12.6.12) (2026-02-04)



## [12.6.11](https://github.com/dereekb/dbx-components/compare/v12.6.10-dev...v12.6.11) (2026-02-03)



## [12.6.10](https://github.com/dereekb/dbx-components/compare/v12.6.9-dev...v12.6.10) (2026-01-30)



## [12.6.9](https://github.com/dereekb/dbx-components/compare/v12.6.8-dev...v12.6.9) (2026-01-26)



## [12.6.8](https://github.com/dereekb/dbx-components/compare/v12.6.7-dev...v12.6.8) (2026-01-19)



## [12.6.7](https://github.com/dereekb/dbx-components/compare/v12.6.6-dev...v12.6.7) (2026-01-06)



## [12.6.6](https://github.com/dereekb/dbx-components/compare/v12.6.5-dev...v12.6.6) (2025-12-31)



## [12.6.5](https://github.com/dereekb/dbx-components/compare/v12.6.4-dev...v12.6.5) (2025-12-30)



## [12.6.4](https://github.com/dereekb/dbx-components/compare/v12.6.3-dev...v12.6.4) (2025-12-16)



## [12.6.3](https://github.com/dereekb/dbx-components/compare/v12.6.2-dev...v12.6.3) (2025-12-16)



## [12.6.2](https://github.com/dereekb/dbx-components/compare/v12.6.1-dev...v12.6.2) (2025-12-08)



## [12.6.1](https://github.com/dereekb/dbx-components/compare/v12.6.0-dev...v12.6.1) (2025-12-07)



# [12.6.0](https://github.com/dereekb/dbx-components/compare/v12.5.10-dev...v12.6.0) (2025-12-02)


### Features

* added StorageFileGroup ([#31](https://github.com/dereekb/dbx-components/issues/31)) ([14be9c3](https://github.com/dereekb/dbx-components/commit/14be9c3f513c27fa1a445e99791050625f174844))



## [12.5.10](https://github.com/dereekb/dbx-components/compare/v12.5.9-dev...v12.5.10) (2025-11-21)



## [12.5.9](https://github.com/dereekb/dbx-components/compare/v12.5.8-dev...v12.5.9) (2025-11-16)



## [12.5.8](https://github.com/dereekb/dbx-components/compare/v12.5.7-dev...v12.5.8) (2025-11-06)



## [12.5.7](https://github.com/dereekb/dbx-components/compare/v12.5.6-dev...v12.5.7) (2025-11-05)



## [12.5.6](https://github.com/dereekb/dbx-components/compare/v12.5.5-dev...v12.5.6) (2025-11-02)



## [12.5.5](https://github.com/dereekb/dbx-components/compare/v12.5.4-dev...v12.5.5) (2025-10-18)



## [12.5.4](https://github.com/dereekb/dbx-components/compare/v12.5.3-dev...v12.5.4) (2025-10-17)



## [12.5.3](https://github.com/dereekb/dbx-components/compare/v12.5.2-dev...v12.5.3) (2025-10-16)



## [12.5.2](https://github.com/dereekb/dbx-components/compare/v12.5.1-dev...v12.5.2) (2025-10-15)



## [12.5.1](https://github.com/dereekb/dbx-components/compare/v12.5.0-dev...v12.5.1) (2025-10-14)



# [12.5.0](https://github.com/dereekb/dbx-components/compare/v12.4.5-dev...v12.5.0) (2025-10-13)


### Features

* added StorageFile ([#30](https://github.com/dereekb/dbx-components/issues/30)) ([1c00f02](https://github.com/dereekb/dbx-components/commit/1c00f0242fa40548ced24799c277acfe5c9ee3bb))



## [12.4.5](https://github.com/dereekb/dbx-components/compare/v12.4.4-dev...v12.4.5) (2025-09-14)



## [12.4.4](https://github.com/dereekb/dbx-components/compare/v12.4.3-dev...v12.4.4) (2025-09-11)



## [12.4.3](https://github.com/dereekb/dbx-components/compare/v12.4.2-dev...v12.4.3) (2025-09-11)



## [12.4.2](https://github.com/dereekb/dbx-components/compare/v12.4.1-dev...v12.4.2) (2025-09-10)



## [12.4.1](https://github.com/dereekb/dbx-components/compare/v12.4.0-dev...v12.4.1) (2025-09-09)



# [12.4.0](https://github.com/dereekb/dbx-components/compare/v12.3.12-dev-dev...v12.4.0) (2025-08-30)



## [12.3.13](https://github.com/dereekb/dbx-components/compare/v12.3.12-dev...v12.3.13) (2025-08-22)



## [12.3.12](https://github.com/dereekb/dbx-components/compare/v12.3.11-dev...v12.3.12) (2025-08-20)



## [12.3.11](https://github.com/dereekb/dbx-components/compare/v12.3.10-dev...v12.3.11) (2025-08-19)



## [12.3.10](https://github.com/dereekb/dbx-components/compare/v12.3.9-dev...v12.3.10) (2025-08-15)



## [12.3.9](https://github.com/dereekb/dbx-components/compare/v12.3.8-dev...v12.3.9) (2025-08-15)



## [12.3.8](https://github.com/dereekb/dbx-components/compare/v12.3.7-dev...v12.3.8) (2025-08-14)



## [12.3.7](https://github.com/dereekb/dbx-components/compare/v12.3.6-dev...v12.3.7) (2025-08-14)



## [12.3.6](https://github.com/dereekb/dbx-components/compare/v12.3.5-dev...v12.3.6) (2025-08-13)



## [12.3.5](https://github.com/dereekb/dbx-components/compare/v12.3.4-dev...v12.3.5) (2025-08-12)



## [12.3.4](https://github.com/dereekb/dbx-components/compare/v12.3.3-dev...v12.3.4) (2025-08-06)



## [12.3.3](https://github.com/dereekb/dbx-components/compare/v12.3.2-dev...v12.3.3) (2025-08-06)



## [12.3.2](https://github.com/dereekb/dbx-components/compare/v12.3.1-dev...v12.3.2) (2025-08-04)



## [12.3.1](https://github.com/dereekb/dbx-components/compare/v12.3.0-dev...v12.3.1) (2025-07-11)



# [12.3.0](https://github.com/dereekb/dbx-components/compare/v12.2.1-dev...v12.3.0) (2025-07-04)



## [12.2.1](https://github.com/dereekb/dbx-components/compare/v12.2.0-dev...v12.2.1) (2025-07-02)



# [12.2.0](https://github.com/dereekb/dbx-components/compare/v12.1.14-dev...v12.2.0) (2025-06-29)



## [12.1.14](https://github.com/dereekb/dbx-components/compare/v12.1.13-dev...v12.1.14) (2025-06-27)



## [12.1.13](https://github.com/dereekb/dbx-components/compare/v12.1.12-dev...v12.1.13) (2025-06-23)



## [12.1.12](https://github.com/dereekb/dbx-components/compare/v12.1.11...v12.1.12) (2025-06-19)



## [12.1.11](https://github.com/dereekb/dbx-components/compare/v12.1.10...v12.1.11) (2025-06-17)



## [12.1.10](https://github.com/dereekb/dbx-components/compare/v12.1.9...v12.1.10) (2025-06-13)



## [12.1.9](https://github.com/dereekb/dbx-components/compare/v12.1.8...v12.1.9) (2025-06-09)



## [12.1.8](https://github.com/dereekb/dbx-components/compare/v12.1.7...v12.1.8) (2025-06-08)



## [12.1.7](https://github.com/dereekb/dbx-components/compare/v12.1.6...v12.1.7) (2025-06-04)



## [12.1.6](https://github.com/dereekb/dbx-components/compare/v12.1.5-dev...v12.1.6) (2025-06-04)



## [12.1.5](https://github.com/dereekb/dbx-components/compare/v12.1.4-dev...v12.1.5) (2025-05-30)



## [12.1.4](https://github.com/dereekb/dbx-components/compare/v12.1.3-dev...v12.1.4) (2025-05-22)



## [12.1.3](https://github.com/dereekb/dbx-components/compare/v12.1.2-dev...v12.1.3) (2025-05-20)



## [12.1.2](https://github.com/dereekb/dbx-components/compare/v12.1.1-dev...v12.1.2) (2025-05-13)



## [12.1.1](https://github.com/dereekb/dbx-components/compare/v12.1.0-dev...v12.1.1) (2025-05-12)



# [12.1.0](https://github.com/dereekb/dbx-components/compare/v12.0.6-dev...v12.1.0) (2025-05-10)



## [12.0.6](https://github.com/dereekb/dbx-components/compare/v12.0.5-dev...v12.0.6) (2025-05-07)



## [12.0.5](https://github.com/dereekb/dbx-components/compare/v12.0.4-dev...v12.0.5) (2025-05-02)



## [12.0.4](https://github.com/dereekb/dbx-components/compare/v12.0.3-dev...v12.0.4) (2025-04-29)



## [12.0.3](https://github.com/dereekb/dbx-components/compare/v12.0.2-dev...v12.0.3) (2025-04-29)



## [12.0.2](https://github.com/dereekb/dbx-components/compare/v12.0.1-dev...v12.0.2) (2025-04-26)



## [12.0.1](https://github.com/dereekb/dbx-components/compare/v12.0.0-dev...v12.0.1) (2025-04-25)



# [12.0.0](https://github.com/dereekb/dbx-components/compare/v11.1.8-dev...v12.0.0) (2025-04-23)


### Features

* angular 18 ([#28](https://github.com/dereekb/dbx-components/issues/28)) ([c8f5472](https://github.com/dereekb/dbx-components/commit/c8f5472026b47c8877f404a9c87bf7a3fa68b45b))



## [11.1.8](https://github.com/dereekb/dbx-components/compare/v11.1.7-dev...v11.1.8) (2025-04-04)



## [11.1.7](https://github.com/dereekb/dbx-components/compare/v11.1.6-dev...v11.1.7) (2025-03-26)



## [11.1.6](https://github.com/dereekb/dbx-components/compare/v11.1.5-dev...v11.1.6) (2025-03-20)



## [11.1.5](https://github.com/dereekb/dbx-components/compare/v11.1.4-dev...v11.1.5) (2025-03-20)



## [11.1.4](https://github.com/dereekb/dbx-components/compare/v11.1.3-dev...v11.1.4) (2025-03-17)



## [11.1.3](https://github.com/dereekb/dbx-components/compare/v11.1.2-dev...v11.1.3) (2025-03-07)



## [11.1.2](https://github.com/dereekb/dbx-components/compare/v11.1.1-dev...v11.1.2) (2025-03-04)



## [11.1.1](https://github.com/dereekb/dbx-components/compare/v11.1.0-dev...v11.1.1) (2025-03-03)



# [11.1.0](https://github.com/dereekb/dbx-components/compare/v11.0.21-dev...v11.1.0) (2025-02-28)


### Features

* notifications ([#27](https://github.com/dereekb/dbx-components/issues/27)) ([d83bdc3](https://github.com/dereekb/dbx-components/commit/d83bdc3c2f308a25cc4cb12e6eedd126e91c46a4))



## [11.0.21](https://github.com/dereekb/dbx-components/compare/v11.0.20-dev...v11.0.21) (2025-01-28)



## [11.0.20](https://github.com/dereekb/dbx-components/compare/v11.0.19-dev...v11.0.20) (2025-01-20)



## [11.0.19](https://github.com/dereekb/dbx-components/compare/v11.0.18-dev...v11.0.19) (2025-01-09)



## [11.0.18](https://github.com/dereekb/dbx-components/compare/v11.0.17-dev...v11.0.18) (2024-12-13)



## [11.0.17](https://github.com/dereekb/dbx-components/compare/v11.0.16-dev...v11.0.17) (2024-12-05)



## [11.0.16](https://github.com/dereekb/dbx-components/compare/v11.0.15-dev...v11.0.16) (2024-12-05)



## [11.0.15](https://github.com/dereekb/dbx-components/compare/v11.0.14-dev...v11.0.15) (2024-11-29)



## [11.0.14](https://github.com/dereekb/dbx-components/compare/v11.0.13-dev...v11.0.14) (2024-11-27)



## [11.0.13](https://github.com/dereekb/dbx-components/compare/v11.0.12-dev...v11.0.13) (2024-11-27)



## [11.0.12](https://github.com/dereekb/dbx-components/compare/v11.0.11-dev...v11.0.12) (2024-11-24)



## [11.0.10](https://github.com/dereekb/dbx-components/compare/v11.0.9-dev...v11.0.10) (2024-11-24)



## [11.0.9](https://github.com/dereekb/dbx-components/compare/v11.0.8-dev...v11.0.9) (2024-11-23)



## [11.0.8](https://github.com/dereekb/dbx-components/compare/v11.0.7-dev...v11.0.8) (2024-11-23)



## [11.0.7](https://github.com/dereekb/dbx-components/compare/v11.0.6-dev...v11.0.7) (2024-11-22)



## [11.0.6](https://github.com/dereekb/dbx-components/compare/v11.0.5-dev...v11.0.6) (2024-11-20)



## [11.0.5](https://github.com/dereekb/dbx-components/compare/v11.0.4-dev...v11.0.5) (2024-11-19)



## [11.0.4](https://github.com/dereekb/dbx-components/compare/v11.0.3-dev...v11.0.4) (2024-11-19)



## [11.0.3](https://github.com/dereekb/dbx-components/compare/v11.0.2-dev...v11.0.3) (2024-11-15)



## [11.0.2](https://github.com/dereekb/dbx-components/compare/v11.0.1-dev...v11.0.2) (2024-11-14)



## [11.0.1](https://github.com/dereekb/dbx-components/compare/v11.0.0-dev...v11.0.1) (2024-11-12)



# [11.0.0](https://github.com/dereekb/dbx-components/compare/v10.2.0-dev...v11.0.0) (2024-11-12)


### Code Refactoring

* completed useDefineForClassFields changes ([517376c](https://github.com/dereekb/dbx-components/commit/517376c9436e422297d1be366c72f4583cf32d71))
* revisited some todos ([4902b4b](https://github.com/dereekb/dbx-components/commit/4902b4bcffde7174c37b72d84fd4473e3b975769))


### BREAKING CHANGES

* all breaking changes are documented in VERSION_MIGRATION.md
* remove constructor from AbstractSubscriptionDirective



# [10.2.0](https://github.com/dereekb/dbx-components/compare/v10.1.30-dev...v10.2.0) (2024-11-07)



## [10.1.30](https://github.com/dereekb/dbx-components/compare/v10.1.29-dev...v10.1.30) (2024-10-23)



## [10.1.29](https://github.com/dereekb/dbx-components/compare/v10.1.28-dev...v10.1.29) (2024-10-20)



## [10.1.28](https://github.com/dereekb/dbx-components/compare/v10.1.27-dev...v10.1.28) (2024-10-12)



## [10.1.27](https://github.com/dereekb/dbx-components/compare/v10.1.26-dev...v10.1.27) (2024-09-26)



## [10.1.26](https://github.com/dereekb/dbx-components/compare/v10.1.25-dev...v10.1.26) (2024-09-12)



## [10.1.25](https://github.com/dereekb/dbx-components/compare/v10.1.24-dev...v10.1.25) (2024-09-09)



## [10.1.24](https://github.com/dereekb/dbx-components/compare/v10.1.23-dev...v10.1.24) (2024-08-13)



## [10.1.23](https://github.com/dereekb/dbx-components/compare/v10.1.22-dev...v10.1.23) (2024-08-01)



## [10.1.22](https://github.com/dereekb/dbx-components/compare/v10.1.21-dev...v10.1.22) (2024-07-15)



## [10.1.21](https://github.com/dereekb/dbx-components/compare/v10.1.20-dev...v10.1.21) (2024-07-09)



## [10.1.20](https://github.com/dereekb/dbx-components/compare/v10.1.19-dev...v10.1.20) (2024-06-12)



## [10.1.19](https://github.com/dereekb/dbx-components/compare/v10.1.18-dev...v10.1.19) (2024-05-24)



## [10.1.18](https://github.com/dereekb/dbx-components/compare/v10.1.17-dev...v10.1.18) (2024-05-21)



## [10.1.17](https://github.com/dereekb/dbx-components/compare/v10.1.16-dev...v10.1.17) (2024-05-21)



## [10.1.16](https://github.com/dereekb/dbx-components/compare/v10.1.15-dev...v10.1.16) (2024-05-15)



## [10.1.15](https://github.com/dereekb/dbx-components/compare/v10.1.14-dev...v10.1.15) (2024-05-14)



## [10.1.14](https://github.com/dereekb/dbx-components/compare/v10.1.13-dev...v10.1.14) (2024-05-14)



## [10.1.13](https://github.com/dereekb/dbx-components/compare/v10.1.12-dev...v10.1.13) (2024-05-13)



## [10.1.12](https://github.com/dereekb/dbx-components/compare/v10.1.11-dev...v10.1.12) (2024-04-30)



## [10.1.11](https://github.com/dereekb/dbx-components/compare/v10.1.10-dev...v10.1.11) (2024-04-27)



## [10.1.10](https://github.com/dereekb/dbx-components/compare/v10.1.9-dev...v10.1.10) (2024-04-12)



## [10.1.9](https://github.com/dereekb/dbx-components/compare/v10.1.8-dev...v10.1.9) (2024-04-10)



## [10.1.8](https://github.com/dereekb/dbx-components/compare/v10.1.7-dev...v10.1.8) (2024-04-02)



## [10.1.7](https://github.com/dereekb/dbx-components/compare/v10.1.6-dev...v10.1.7) (2024-03-28)



## [10.1.6](https://github.com/dereekb/dbx-components/compare/v10.1.5-dev...v10.1.6) (2024-03-26)


### Bug Fixes

* fix unintentional deprecated variable renaming ([5f28f51](https://github.com/dereekb/dbx-components/commit/5f28f51ed569a16f277daa779157e4c64554180e))



## [10.1.5](https://github.com/dereekb/dbx-components/compare/v10.1.4-dev...v10.1.5) (2024-03-22)



## [10.1.4](https://github.com/dereekb/dbx-components/compare/v10.1.3-dev...v10.1.4) (2024-03-14)



## [10.1.3](https://github.com/dereekb/dbx-components/compare/v10.1.2-dev...v10.1.3) (2024-03-11)



## [10.1.2](https://github.com/dereekb/dbx-components/compare/v10.1.1-dev...v10.1.2) (2024-03-06)



## [10.1.1](https://github.com/dereekb/dbx-components/compare/v10.1.0-dev...v10.1.1) (2024-03-05)



# [10.1.0](https://github.com/dereekb/dbx-components/compare/v10.0.24-dev...v10.1.0) (2024-03-01)



## [10.0.24](https://github.com/dereekb/dbx-components/compare/v10.0.23-dev...v10.0.24) (2024-02-28)



## [10.0.23](https://github.com/dereekb/dbx-components/compare/v10.0.22-dev...v10.0.23) (2024-02-27)



## [10.0.22](https://github.com/dereekb/dbx-components/compare/v10.0.21-dev...v10.0.22) (2024-02-19)



## [10.0.21](https://github.com/dereekb/dbx-components/compare/v10.0.20-dev...v10.0.21) (2024-02-17)



## [10.0.20](https://github.com/dereekb/dbx-components/compare/v10.0.19-dev...v10.0.20) (2024-02-15)



## [10.0.19](https://github.com/dereekb/dbx-components/compare/v10.0.18-dev...v10.0.19) (2024-02-13)



## [10.0.18](https://github.com/dereekb/dbx-components/compare/v10.0.17-dev...v10.0.18) (2024-02-13)



## [10.0.17](https://github.com/dereekb/dbx-components/compare/v10.0.16-dev...v10.0.17) (2024-02-06)



## [10.0.16](https://github.com/dereekb/dbx-components/compare/v10.0.15-dev...v10.0.16) (2024-02-05)



## [10.0.15](https://github.com/dereekb/dbx-components/compare/v10.0.14-dev...v10.0.15) (2024-02-03)



## [10.0.14](https://github.com/dereekb/dbx-components/compare/v10.0.13-dev...v10.0.14) (2024-01-31)



## [10.0.13](https://github.com/dereekb/dbx-components/compare/v10.0.12-dev...v10.0.13) (2024-01-29)



## [10.0.12](https://github.com/dereekb/dbx-components/compare/v10.0.11-dev...v10.0.12) (2024-01-27)



## [10.0.11](https://github.com/dereekb/dbx-components/compare/v10.0.10-dev...v10.0.11) (2024-01-25)



## [10.0.10](https://github.com/dereekb/dbx-components/compare/v10.0.9-dev...v10.0.10) (2024-01-21)



## [10.0.9](https://github.com/dereekb/dbx-components/compare/v10.0.8-dev...v10.0.9) (2024-01-15)



## [10.0.8](https://github.com/dereekb/dbx-components/compare/v10.0.7-dev...v10.0.8) (2024-01-14)



## [10.0.7](https://github.com/dereekb/dbx-components/compare/v10.0.6-dev...v10.0.7) (2024-01-13)



## [10.0.6](https://github.com/dereekb/dbx-components/compare/v10.0.5-dev...v10.0.6) (2024-01-13)



## [10.0.5](https://github.com/dereekb/dbx-components/compare/v10.0.4-dev...v10.0.5) (2024-01-12)



## [10.0.4](https://github.com/dereekb/dbx-components/compare/v10.0.3-dev...v10.0.4) (2024-01-12)



## [10.0.3](https://github.com/dereekb/dbx-components/compare/v10.0.2-dev...v10.0.3) (2024-01-12)



## [10.0.2](https://github.com/dereekb/dbx-components/compare/v10.0.1-dev...v10.0.2) (2024-01-11)



## [10.0.1](https://github.com/dereekb/dbx-components/compare/v10.0.0-dev...v10.0.1) (2024-01-11)



# [10.0.0](https://github.com/dereekb/dbx-components/compare/v9.25.17...v10.0.0) (2024-01-10)



## [9.25.17](https://github.com/dereekb/dbx-components/compare/v10.0.0-pre...v9.25.17) (2024-01-10)



## [9.25.16](https://github.com/dereekb/dbx-components/compare/v9.25.15-dev...v9.25.16) (2023-12-01)



## [9.25.15](https://github.com/dereekb/dbx-components/compare/v9.25.14-dev...v9.25.15) (2023-11-27)



## [9.25.14](https://github.com/dereekb/dbx-components/compare/v9.25.13-dev...v9.25.14) (2023-11-23)



## [9.25.13](https://github.com/dereekb/dbx-components/compare/v9.25.12-dev...v9.25.13) (2023-11-15)



## [9.25.12](https://github.com/dereekb/dbx-components/compare/v9.25.11-dev...v9.25.12) (2023-11-14)



## [9.25.11](https://github.com/dereekb/dbx-components/compare/v9.25.10-dev...v9.25.11) (2023-11-11)



## [9.25.10](https://github.com/dereekb/dbx-components/compare/v9.25.9-dev...v9.25.10) (2023-11-01)



## [9.25.9](https://github.com/dereekb/dbx-components/compare/v9.25.8-dev...v9.25.9) (2023-10-31)



## [9.25.8](https://github.com/dereekb/dbx-components/compare/v9.25.7-dev...v9.25.8) (2023-10-31)



## [9.25.7](https://github.com/dereekb/dbx-components/compare/v9.25.6-dev...v9.25.7) (2023-10-26)



## [9.25.6](https://github.com/dereekb/dbx-components/compare/v9.25.5-dev...v9.25.6) (2023-10-17)



## [9.25.5](https://github.com/dereekb/dbx-components/compare/v9.25.4-dev...v9.25.5) (2023-10-16)



## [9.25.4](https://github.com/dereekb/dbx-components/compare/v9.25.3-dev...v9.25.4) (2023-10-16)



## [9.25.3](https://github.com/dereekb/dbx-components/compare/v9.25.2-dev...v9.25.3) (2023-10-15)



## [9.25.2](https://github.com/dereekb/dbx-components/compare/v9.25.1-dev...v9.25.2) (2023-10-14)



## [9.25.1](https://github.com/dereekb/dbx-components/compare/v9.25.0-dev...v9.25.1) (2023-10-13)



# [9.25.0](https://github.com/dereekb/dbx-components/compare/v9.24.47-dev...v9.25.0) (2023-10-10)



## [9.24.47](https://github.com/dereekb/dbx-components/compare/v9.24.46-dev...v9.24.47) (2023-10-08)



## [9.24.46](https://github.com/dereekb/dbx-components/compare/v9.24.45-dev...v9.24.46) (2023-09-21)



## [9.24.45](https://github.com/dereekb/dbx-components/compare/v9.24.44-dev...v9.24.45) (2023-09-20)



## [9.24.44](https://github.com/dereekb/dbx-components/compare/v9.24.43-dev...v9.24.44) (2023-09-14)



## [9.24.43](https://github.com/dereekb/dbx-components/compare/v9.24.42-dev...v9.24.43) (2023-09-06)



## [9.24.42](https://github.com/dereekb/dbx-components/compare/v9.24.41-dev...v9.24.42) (2023-08-31)



## [9.24.41](https://github.com/dereekb/dbx-components/compare/v9.24.40-dev...v9.24.41) (2023-08-30)



## [9.24.40](https://github.com/dereekb/dbx-components/compare/v9.24.39-dev...v9.24.40) (2023-08-30)



## [9.24.39](https://github.com/dereekb/dbx-components/compare/v9.24.38-dev...v9.24.39) (2023-08-30)



## [9.24.38](https://github.com/dereekb/dbx-components/compare/v9.24.37-dev...v9.24.38) (2023-08-26)



## [9.24.37](https://github.com/dereekb/dbx-components/compare/v9.24.36-dev...v9.24.37) (2023-08-26)



## [9.24.36](https://github.com/dereekb/dbx-components/compare/v9.24.35-dev...v9.24.36) (2023-08-25)



## [9.24.35](https://github.com/dereekb/dbx-components/compare/v9.24.34-dev...v9.24.35) (2023-08-24)



## [9.24.34](https://github.com/dereekb/dbx-components/compare/v9.24.33-dev...v9.24.34) (2023-08-23)



## [9.24.33](https://github.com/dereekb/dbx-components/compare/v9.24.32-dev...v9.24.33) (2023-08-23)



## [9.24.32](https://github.com/dereekb/dbx-components/compare/v9.24.31-dev...v9.24.32) (2023-08-18)



## [9.24.31](https://github.com/dereekb/dbx-components/compare/v9.24.30-dev...v9.24.31) (2023-08-17)



## [9.24.30](https://github.com/dereekb/dbx-components/compare/v9.24.29-dev...v9.24.30) (2023-08-16)



## [9.24.29](https://github.com/dereekb/dbx-components/compare/v9.24.28-dev...v9.24.29) (2023-08-15)



## [9.24.28](https://github.com/dereekb/dbx-components/compare/v9.24.27-dev...v9.24.28) (2023-08-15)



## [9.24.27](https://github.com/dereekb/dbx-components/compare/v9.24.26-dev...v9.24.27) (2023-08-15)



## [9.24.26](https://github.com/dereekb/dbx-components/compare/v9.24.25-dev...v9.24.26) (2023-08-10)



## [9.24.25](https://github.com/dereekb/dbx-components/compare/v9.24.24-dev...v9.24.25) (2023-08-07)



## [9.24.24](https://github.com/dereekb/dbx-components/compare/v9.24.23-dev...v9.24.24) (2023-08-05)



## [9.24.23](https://github.com/dereekb/dbx-components/compare/v9.24.22-dev...v9.24.23) (2023-08-05)



## [9.24.22](https://github.com/dereekb/dbx-components/compare/v9.24.21-dev...v9.24.22) (2023-08-04)



## [9.24.21](https://github.com/dereekb/dbx-components/compare/v9.24.20-dev...v9.24.21) (2023-08-03)



## [9.24.20](https://github.com/dereekb/dbx-components/compare/v9.24.19-dev...v9.24.20) (2023-08-01)



## [9.24.19](https://github.com/dereekb/dbx-components/compare/v9.24.18-dev...v9.24.19) (2023-07-30)



## [9.24.18](https://github.com/dereekb/dbx-components/compare/v9.24.17-dev...v9.24.18) (2023-07-30)



## [9.24.17](https://github.com/dereekb/dbx-components/compare/v9.24.16-dev...v9.24.17) (2023-07-24)



## [9.24.16](https://github.com/dereekb/dbx-components/compare/v9.24.15-dev...v9.24.16) (2023-07-14)



## [9.24.15](https://github.com/dereekb/dbx-components/compare/v9.24.14-dev...v9.24.15) (2023-07-13)



## [9.24.14](https://github.com/dereekb/dbx-components/compare/v9.24.13-dev...v9.24.14) (2023-07-10)



## [9.24.13](https://github.com/dereekb/dbx-components/compare/v9.24.12-dev...v9.24.13) (2023-07-08)



## [9.24.12](https://github.com/dereekb/dbx-components/compare/v9.24.11-dev...v9.24.12) (2023-07-04)



## [9.24.11](https://github.com/dereekb/dbx-components/compare/v9.24.10-dev...v9.24.11) (2023-07-03)



## [9.24.10](https://github.com/dereekb/dbx-components/compare/v9.24.9-dev...v9.24.10) (2023-07-02)



## [9.24.9](https://github.com/dereekb/dbx-components/compare/v9.24.8-dev...v9.24.9) (2023-06-30)



## [9.24.8](https://github.com/dereekb/dbx-components/compare/v9.24.7-dev...v9.24.8) (2023-06-30)



## [9.24.7](https://github.com/dereekb/dbx-components/compare/v9.24.6-dev...v9.24.7) (2023-06-29)



## [9.24.6](https://github.com/dereekb/dbx-components/compare/v9.24.5-dev...v9.24.6) (2023-06-27)



## [9.24.5](https://github.com/dereekb/dbx-components/compare/v9.24.4-dev...v9.24.5) (2023-06-27)



## [9.24.4](https://github.com/dereekb/dbx-components/compare/v9.24.3-dev...v9.24.4) (2023-06-26)



## [9.24.3](https://github.com/dereekb/dbx-components/compare/v9.24.2-dev...v9.24.3) (2023-06-20)



## [9.24.2](https://github.com/dereekb/dbx-components/compare/v9.24.1-dev...v9.24.2) (2023-06-19)



## [9.24.1](https://github.com/dereekb/dbx-components/compare/v9.24.0-dev...v9.24.1) (2023-06-16)



# [9.24.0](https://github.com/dereekb/dbx-components/compare/v9.23.28-dev...v9.24.0) (2023-06-15)



## [9.23.28](https://github.com/dereekb/dbx-components/compare/v9.23.27-dev...v9.23.28) (2023-06-08)



## [9.23.27](https://github.com/dereekb/dbx-components/compare/v9.23.26-dev...v9.23.27) (2023-06-06)



## [9.23.26](https://github.com/dereekb/dbx-components/compare/v9.23.25-dev...v9.23.26) (2023-06-05)



## [9.23.25](https://github.com/dereekb/dbx-components/compare/v9.23.24-dev...v9.23.25) (2023-05-31)



## [9.23.24](https://github.com/dereekb/dbx-components/compare/v9.23.23-dev...v9.23.24) (2023-05-30)



## [9.23.23](https://github.com/dereekb/dbx-components/compare/v9.23.22-dev...v9.23.23) (2023-05-30)



## [9.23.22](https://github.com/dereekb/dbx-components/compare/v9.23.21-dev...v9.23.22) (2023-05-29)



## [9.23.21](https://github.com/dereekb/dbx-components/compare/v9.23.20-dev...v9.23.21) (2023-05-27)



## [9.23.20](https://github.com/dereekb/dbx-components/compare/v9.23.19-dev...v9.23.20) (2023-05-19)



## [9.23.19](https://github.com/dereekb/dbx-components/compare/v9.23.18-dev...v9.23.19) (2023-05-11)



## [9.23.18](https://github.com/dereekb/dbx-components/compare/v9.23.17-dev...v9.23.18) (2023-05-10)



## [9.23.17](https://github.com/dereekb/dbx-components/compare/v9.23.16-dev...v9.23.17) (2023-05-04)



## [9.23.16](https://github.com/dereekb/dbx-components/compare/v9.23.15-dev...v9.23.16) (2023-05-02)



## [9.23.15](https://github.com/dereekb/dbx-components/compare/v9.23.14-dev...v9.23.15) (2023-05-01)



## [9.23.14](https://github.com/dereekb/dbx-components/compare/v9.23.13-dev...v9.23.14) (2023-04-30)



## [9.23.13](https://github.com/dereekb/dbx-components/compare/v9.23.12-dev...v9.23.13) (2023-04-25)



## [9.23.12](https://github.com/dereekb/dbx-components/compare/v9.23.11-dev...v9.23.12) (2023-04-23)



## [9.23.11](https://github.com/dereekb/dbx-components/compare/v9.23.10-dev...v9.23.11) (2023-04-21)



## [9.23.10](https://github.com/dereekb/dbx-components/compare/v9.23.9-dev...v9.23.10) (2023-04-20)



## [9.23.9](https://github.com/dereekb/dbx-components/compare/v9.23.8-dev...v9.23.9) (2023-04-13)



## [9.23.8](https://github.com/dereekb/dbx-components/compare/v9.23.7-dev...v9.23.8) (2023-04-12)



## [9.23.7](https://github.com/dereekb/dbx-components/compare/v9.23.6-dev...v9.23.7) (2023-04-10)



## [9.23.6](https://github.com/dereekb/dbx-components/compare/v9.23.5-dev...v9.23.6) (2023-04-09)



## [9.23.5](https://github.com/dereekb/dbx-components/compare/v9.23.4-dev...v9.23.5) (2023-04-04)



## [9.23.4](https://github.com/dereekb/dbx-components/compare/v9.23.3-dev...v9.23.4) (2023-04-01)



## [9.23.3](https://github.com/dereekb/dbx-components/compare/v9.23.2-dev...v9.23.3) (2023-03-30)



## [9.23.2](https://github.com/dereekb/dbx-components/compare/v9.23.1-dev...v9.23.2) (2023-03-30)



## [9.23.1](https://github.com/dereekb/dbx-components/compare/v9.23.0-dev...v9.23.1) (2023-03-30)



# [9.23.0](https://github.com/dereekb/dbx-components/compare/v9.22.11-dev...v9.23.0) (2023-03-28)



## [9.22.11](https://github.com/dereekb/dbx-components/compare/v9.22.10-dev...v9.22.11) (2023-03-26)



## [9.22.10](https://github.com/dereekb/dbx-components/compare/v9.22.9-dev...v9.22.10) (2023-03-22)



## [9.22.9](https://github.com/dereekb/dbx-components/compare/v9.22.8-dev...v9.22.9) (2023-03-21)



## [9.22.8](https://github.com/dereekb/dbx-components/compare/v9.22.7-dev...v9.22.8) (2023-03-06)



## [9.22.7](https://github.com/dereekb/dbx-components/compare/v9.22.6-dev...v9.22.7) (2023-03-03)



## [9.22.6](https://github.com/dereekb/dbx-components/compare/v9.22.5-dev...v9.22.6) (2023-03-02)



## [9.22.5](https://github.com/dereekb/dbx-components/compare/v9.22.4-dev...v9.22.5) (2023-02-28)



## [9.22.4](https://github.com/dereekb/dbx-components/compare/v9.22.3-dev...v9.22.4) (2023-02-27)


### Bug Fixes

* fixed ClickableFilterPreset type ([5bab6db](https://github.com/dereekb/dbx-components/commit/5bab6db5f5bf97a373ef6f057effb6bfc28310d5))



## [9.22.3](https://github.com/dereekb/dbx-components/compare/v9.22.2-dev...v9.22.3) (2023-02-27)



## [9.22.2](https://github.com/dereekb/dbx-components/compare/v9.22.1-dev...v9.22.2) (2023-02-25)



## [9.22.1](https://github.com/dereekb/dbx-components/compare/v9.22.0-dev...v9.22.1) (2023-02-24)



# [9.22.0](https://github.com/dereekb/dbx-components/compare/v9.21.0-dev...v9.22.0) (2023-02-20)



# [9.21.0](https://github.com/dereekb/dbx-components/compare/v9.20.20-dev...v9.21.0) (2023-01-31)


### Features

* dbx-table ([#23](https://github.com/dereekb/dbx-components/issues/23)) ([4661508](https://github.com/dereekb/dbx-components/commit/466150895b5bdc6e9e5289ef38ef5dd3e0ae67f9))



## [9.20.20](https://github.com/dereekb/dbx-components/compare/v9.20.19-dev...v9.20.20) (2023-01-23)



## [9.20.19](https://github.com/dereekb/dbx-components/compare/v9.20.18-dev...v9.20.19) (2023-01-17)



## [9.20.18](https://github.com/dereekb/dbx-components/compare/v9.20.17-dev...v9.20.18) (2023-01-08)



## [9.20.17](https://github.com/dereekb/dbx-components/compare/v9.20.16-dev...v9.20.17) (2023-01-05)



## [9.20.16](https://github.com/dereekb/dbx-components/compare/v9.20.15-dev...v9.20.16) (2023-01-05)



## [9.20.15](https://github.com/dereekb/dbx-components/compare/v9.20.14-dev...v9.20.15) (2023-01-05)



## [9.20.14](https://github.com/dereekb/dbx-components/compare/v9.20.13-dev...v9.20.14) (2023-01-04)



## [9.20.13](https://github.com/dereekb/dbx-components/compare/v9.20.12-dev...v9.20.13) (2023-01-04)



## [9.20.12](https://github.com/dereekb/dbx-components/compare/v9.20.11-dev...v9.20.12) (2023-01-04)



## [9.20.11](https://github.com/dereekb/dbx-components/compare/v9.20.10-dev...v9.20.11) (2023-01-03)



## [9.20.10](https://github.com/dereekb/dbx-components/compare/v9.20.9-dev...v9.20.10) (2023-01-03)



## [9.20.9](https://github.com/dereekb/dbx-components/compare/v9.20.8-dev...v9.20.9) (2023-01-01)



## [9.20.8](https://github.com/dereekb/dbx-components/compare/v9.20.7-dev...v9.20.8) (2022-12-31)



## [9.20.7](https://github.com/dereekb/dbx-components/compare/v9.20.6-dev...v9.20.7) (2022-12-31)



## [9.20.6](https://github.com/dereekb/dbx-components/compare/v9.20.5-dev...v9.20.6) (2022-12-26)



## [9.20.5](https://github.com/dereekb/dbx-components/compare/v9.20.4-dev...v9.20.5) (2022-12-26)



## [9.20.4](https://github.com/dereekb/dbx-components/compare/v9.20.3-dev...v9.20.4) (2022-12-24)



## [9.20.3](https://github.com/dereekb/dbx-components/compare/v9.20.2-dev...v9.20.3) (2022-12-22)



## [9.20.2](https://github.com/dereekb/dbx-components/compare/v9.20.1-dev...v9.20.2) (2022-12-21)



## [9.20.1](https://github.com/dereekb/dbx-components/compare/v9.20.0-dev...v9.20.1) (2022-12-19)



# [9.20.0](https://github.com/dereekb/dbx-components/compare/v9.19.5-dev...v9.20.0) (2022-12-19)


### Features

* added DbxFirebaseModelTypesService ([d711abb](https://github.com/dereekb/dbx-components/commit/d711abba56b507fa53e5a907d104717ac68106ca))



## [9.19.5](https://github.com/dereekb/dbx-components/compare/v9.19.4-dev...v9.19.5) (2022-12-17)



## [9.19.4](https://github.com/dereekb/dbx-components/compare/v9.19.3-dev...v9.19.4) (2022-12-17)



## [9.19.3](https://github.com/dereekb/dbx-components/compare/v9.19.2-dev...v9.19.3) (2022-12-13)



## [9.19.2](https://github.com/dereekb/dbx-components/compare/v9.19.1-dev...v9.19.2) (2022-12-13)



## [9.19.1](https://github.com/dereekb/dbx-components/compare/v9.19.0-dev...v9.19.1) (2022-12-12)



# [9.19.0](https://github.com/dereekb/dbx-components/compare/v9.18.6-dev...v9.19.0) (2022-12-11)



## [9.18.6](https://github.com/dereekb/dbx-components/compare/v9.18.5-dev...v9.18.6) (2022-12-10)



## [9.18.5](https://github.com/dereekb/dbx-components/compare/v9.18.4-dev...v9.18.5) (2022-12-10)


### Bug Fixes

* fixed mapbox fields marked issue ([04e6e3a](https://github.com/dereekb/dbx-components/commit/04e6e3a50ff02580264e802e320072155830eea2))



## [9.18.4](https://github.com/dereekb/dbx-components/compare/v9.18.3-dev...v9.18.4) (2022-12-09)



## [9.18.3](https://github.com/dereekb/dbx-components/compare/v9.18.2-dev...v9.18.3) (2022-12-09)



## [9.18.2](https://github.com/dereekb/dbx-components/compare/v9.18.1-dev...v9.18.2) (2022-12-08)



## [9.18.1](https://github.com/dereekb/dbx-components/compare/v9.18.0-dev...v9.18.1) (2022-12-07)



# [9.18.0](https://github.com/dereekb/dbx-components/compare/v9.17.3-dev...v9.18.0) (2022-12-07)



## [9.17.3](https://github.com/dereekb/dbx-components/compare/v9.17.2-dev...v9.17.3) (2022-12-01)



## [9.17.2](https://github.com/dereekb/dbx-components/compare/v9.17.1-dev...v9.17.2) (2022-11-28)



## [9.17.1](https://github.com/dereekb/dbx-components/compare/v9.17.0-dev...v9.17.1) (2022-11-27)



# [9.17.0](https://github.com/dereekb/dbx-components/compare/v9.16.4-dev...v9.17.0) (2022-11-25)



## [9.16.4](https://github.com/dereekb/dbx-components/compare/v9.16.3-dev...v9.16.4) (2022-11-23)



## [9.16.3](https://github.com/dereekb/dbx-components/compare/v9.16.2-dev...v9.16.3) (2022-11-23)



## [9.16.2](https://github.com/dereekb/dbx-components/compare/v9.16.1-dev...v9.16.2) (2022-11-22)



## [9.16.1](https://github.com/dereekb/dbx-components/compare/v9.16.0-dev...v9.16.1) (2022-11-20)



# [9.16.0](https://github.com/dereekb/dbx-components/compare/v9.15.8-dev...v9.16.0) (2022-11-20)


### Features

* added DbxPresetMenuFilter ([2c08ad7](https://github.com/dereekb/dbx-components/commit/2c08ad79e464dac307d0dd347487b4e7d3d75a6b))



## [9.15.8](https://github.com/dereekb/dbx-components/compare/v9.15.7-dev...v9.15.8) (2022-11-19)


### Bug Fixes

* fixed dbxFormSourceObservable() emission ([cf927b4](https://github.com/dereekb/dbx-components/commit/cf927b4345ab1bd9d8d0eb4addcd4f7b9efba9e0))



## [9.15.7](https://github.com/dereekb/dbx-components/compare/v9.15.6-dev...v9.15.7) (2022-11-17)



## [9.15.6](https://github.com/dereekb/dbx-components/compare/v9.15.5-dev...v9.15.6) (2022-11-17)



## [9.15.5](https://github.com/dereekb/dbx-components/compare/v9.15.4-dev...v9.15.5) (2022-11-14)


### Bug Fixes

* fixed redirectForUserIdentifierParamHook() ([1be07a3](https://github.com/dereekb/dbx-components/commit/1be07a3ea9a0b7f8fbe583fe2914b5245cad7b98))



## [9.15.4](https://github.com/dereekb/dbx-components/compare/v9.15.3-dev...v9.15.4) (2022-11-13)



## [9.15.3](https://github.com/dereekb/dbx-components/compare/v9.15.2-dev...v9.15.3) (2022-11-13)



## [9.15.2](https://github.com/dereekb/dbx-components/compare/v9.15.1-dev...v9.15.2) (2022-11-12)



## [9.15.1](https://github.com/dereekb/dbx-components/compare/v9.15.0-dev...v9.15.1) (2022-11-11)



# [9.15.0](https://github.com/dereekb/dbx-components/compare/v9.14.2-dev...v9.15.0) (2022-11-10)


### Features

* added redirectForUserIdentifierParamHook ([0f8467d](https://github.com/dereekb/dbx-components/commit/0f8467d928200b35b10484dafe5bf5a6aff7d455))



## [9.14.2](https://github.com/dereekb/dbx-components/compare/v9.14.1-dev...v9.14.2) (2022-11-09)



## [9.14.1](https://github.com/dereekb/dbx-components/compare/v9.14.0-dev...v9.14.1) (2022-11-09)



# [9.14.0](https://github.com/dereekb/dbx-components/compare/v9.13.0-dev...v9.14.0) (2022-11-09)



# [9.13.0](https://github.com/dereekb/dbx-components/compare/v9.12.4-dev...v9.13.0) (2022-11-08)



## [9.12.4](https://github.com/dereekb/dbx-components/compare/v9.12.3-dev...v9.12.4) (2022-11-08)



## [9.12.3](https://github.com/dereekb/dbx-components/compare/v9.12.2-dev...v9.12.3) (2022-11-07)



## [9.12.2](https://github.com/dereekb/dbx-components/compare/v9.12.1-dev...v9.12.2) (2022-11-07)



## [9.12.1](https://github.com/dereekb/dbx-components/compare/v9.12.0-dev...v9.12.1) (2022-11-07)



# [9.12.0](https://github.com/dereekb/dbx-components/compare/v9.11.13-dev...v9.12.0) (2022-11-07)



## [9.11.13](https://github.com/dereekb/dbx-components/compare/v9.11.12-dev...v9.11.13) (2022-11-05)



## [9.11.12](https://github.com/dereekb/dbx-components/compare/v9.11.11-dev...v9.11.12) (2022-11-04)



## [9.11.11](https://github.com/dereekb/dbx-components/compare/v9.11.10-dev...v9.11.11) (2022-11-01)



## [9.11.10](https://github.com/dereekb/dbx-components/compare/v9.11.9-dev...v9.11.10) (2022-10-28)



## [9.11.9](https://github.com/dereekb/dbx-components/compare/v9.11.8-dev...v9.11.9) (2022-10-28)



## [9.11.8](https://github.com/dereekb/dbx-components/compare/v9.11.7-dev...v9.11.8) (2022-10-26)



## [9.11.7](https://github.com/dereekb/dbx-components/compare/v9.11.6-dev...v9.11.7) (2022-10-20)



## [9.11.6](https://github.com/dereekb/dbx-components/compare/v9.11.5-dev...v9.11.6) (2022-10-13)



## [9.11.5](https://github.com/dereekb/dbx-components/compare/v9.11.4-dev...v9.11.5) (2022-10-13)



## [9.11.4](https://github.com/dereekb/dbx-components/compare/v9.11.3-dev...v9.11.4) (2022-10-10)



## [9.11.3](https://github.com/dereekb/dbx-components/compare/v9.11.2-dev...v9.11.3) (2022-10-10)



## [9.11.2](https://github.com/dereekb/dbx-components/compare/v9.11.1-dev...v9.11.2) (2022-10-09)



## [9.11.1](https://github.com/dereekb/dbx-components/compare/v9.11.0-dev...v9.11.1) (2022-10-09)



# [9.11.0](https://github.com/dereekb/dbx-components/compare/v9.10.4-dev...v9.11.0) (2022-10-09)



## [9.10.4](https://github.com/dereekb/dbx-components/compare/v9.10.3-dev...v9.10.4) (2022-10-07)



## [9.10.3](https://github.com/dereekb/dbx-components/compare/v9.10.2-dev...v9.10.3) (2022-10-07)



## [9.10.2](https://github.com/dereekb/dbx-components/compare/v9.10.1-dev...v9.10.2) (2022-10-06)



## [9.10.1](https://github.com/dereekb/dbx-components/compare/v9.10.0-dev...v9.10.1) (2022-10-06)



# [9.10.0](https://github.com/dereekb/dbx-components/compare/v9.9.5-dev...v9.10.0) (2022-10-05)



## [9.9.5](https://github.com/dereekb/dbx-components/compare/v9.9.4-dev...v9.9.5) (2022-09-19)



## [9.9.4](https://github.com/dereekb/dbx-components/compare/v9.9.3-dev...v9.9.4) (2022-09-19)



## [9.9.3](https://github.com/dereekb/dbx-components/compare/v9.9.2-dev...v9.9.3) (2022-09-19)



## [9.9.2](https://github.com/dereekb/dbx-components/compare/v9.9.1-dev...v9.9.2) (2022-09-19)



## [9.9.1](https://github.com/dereekb/dbx-components/compare/v9.9.0-dev...v9.9.1) (2022-09-18)



# [9.9.0](https://github.com/dereekb/dbx-components/compare/v9.8.0-dev...v9.9.0) (2022-09-17)



# [9.8.0](https://github.com/dereekb/dbx-components/compare/v9.7.7-dev...v9.8.0) (2022-09-15)



## [9.7.7](https://github.com/dereekb/dbx-components/compare/v9.7.6-dev...v9.7.7) (2022-09-12)



## [9.7.6](https://github.com/dereekb/dbx-components/compare/v9.7.5-dev...v9.7.6) (2022-09-12)



## [9.7.5](https://github.com/dereekb/dbx-components/compare/v9.7.4-dev...v9.7.5) (2022-09-10)



## [9.7.4](https://github.com/dereekb/dbx-components/compare/v9.7.3-dev...v9.7.4) (2022-09-08)



## [9.7.3](https://github.com/dereekb/dbx-components/compare/v9.7.2-dev...v9.7.3) (2022-09-06)



## [9.7.2](https://github.com/dereekb/dbx-components/compare/v9.7.1-dev...v9.7.2) (2022-09-06)



## [9.7.1](https://github.com/dereekb/dbx-components/compare/v9.7.0-dev...v9.7.1) (2022-09-06)



# [9.7.0](https://github.com/dereekb/dbx-components/compare/v9.6.5-dev...v9.7.0) (2022-09-05)



## [9.6.5](https://github.com/dereekb/dbx-components/compare/v9.6.4-dev...v9.6.5) (2022-09-04)



## [9.6.4](https://github.com/dereekb/dbx-components/compare/v9.6.3-dev...v9.6.4) (2022-09-03)



## [9.6.3](https://github.com/dereekb/dbx-components/compare/v9.6.2-dev...v9.6.3) (2022-09-02)



## [9.6.2](https://github.com/dereekb/dbx-components/compare/v9.6.1-dev...v9.6.2) (2022-09-02)



## [9.6.1](https://github.com/dereekb/dbx-components/compare/v9.6.0-dev...v9.6.1) (2022-08-31)



# [9.6.0](https://github.com/dereekb/dbx-components/compare/v9.5.5-dev...v9.6.0) (2022-08-31)


### Bug Fixes

* added error handling to DbxFirebaseAuthService authUserState ([206132f](https://github.com/dereekb/dbx-components/commit/206132f2dcc0c40adfd889ad98f70396021f87d1))



## [9.5.5](https://github.com/dereekb/dbx-components/compare/v9.5.4-dev...v9.5.5) (2022-08-30)


### Bug Fixes

* fixed isLatestSuccessfulRoute() initial value ([fbde919](https://github.com/dereekb/dbx-components/commit/fbde91949b9e331b58d3aa7907198b5431220952))



## [9.5.4](https://github.com/dereekb/dbx-components/compare/v9.5.3-dev...v9.5.4) (2022-08-30)



## [9.5.3](https://github.com/dereekb/dbx-components/compare/v9.5.2-dev...v9.5.3) (2022-08-29)



## [9.5.2](https://github.com/dereekb/dbx-components/compare/v9.5.1-dev...v9.5.2) (2022-08-29)



## [9.5.1](https://github.com/dereekb/dbx-components/compare/v9.5.0-dev...v9.5.1) (2022-08-26)



# [9.5.0](https://github.com/dereekb/dbx-components/compare/v9.4.0-dev...v9.5.0) (2022-08-24)



# [9.4.0](https://github.com/dereekb/dbx-components/compare/v9.3.3-dev...v9.4.0) (2022-08-24)



## [9.3.3](https://github.com/dereekb/dbx-components/compare/v9.3.2-dev...v9.3.3) (2022-08-23)



## [9.3.2](https://github.com/dereekb/dbx-components/compare/v9.3.1-dev...v9.3.2) (2022-08-22)



## [9.3.1](https://github.com/dereekb/dbx-components/compare/v9.3.0-dev...v9.3.1) (2022-08-21)



# [9.3.0](https://github.com/dereekb/dbx-components/compare/v9.2.0-dev...v9.3.0) (2022-08-20)



# [9.2.0](https://github.com/dereekb/dbx-components/compare/v9.1.2-dev...v9.2.0) (2022-08-18)



## [9.1.2](https://github.com/dereekb/dbx-components/compare/v9.1.1-dev...v9.1.2) (2022-08-16)



## [9.1.1](https://github.com/dereekb/dbx-components/compare/v9.1.0-dev...v9.1.1) (2022-08-16)



# [9.1.0](https://github.com/dereekb/dbx-components/compare/v9.0.0-dev...v9.1.0) (2022-08-15)



# [9.0.0](https://github.com/dereekb/dbx-components/compare/v8.15.2-dev...v9.0.0) (2022-08-13)


### Features

* updated to angular 14 ([#15](https://github.com/dereekb/dbx-components/issues/15)) ([739726e](https://github.com/dereekb/dbx-components/commit/739726eabdf49007b096dbb892054887268c7732))



## [8.15.2](https://github.com/dereekb/dbx-components/compare/v8.15.1-dev...v8.15.2) (2022-08-11)



## [8.15.1](https://github.com/dereekb/dbx-components/compare/v8.15.0-dev...v8.15.1) (2022-08-11)



# [8.15.0](https://github.com/dereekb/dbx-components/compare/v8.14.0-dev...v8.15.0) (2022-08-09)



# [8.14.0](https://github.com/dereekb/dbx-components/compare/v8.13.9-dev...v8.14.0) (2022-08-08)


### Features

* added DbxWidgetViewComponent ([6cf8d3a](https://github.com/dereekb/dbx-components/commit/6cf8d3a701b84ada9db735de5d08d3967debb1a2))



## [8.13.9](https://github.com/dereekb/dbx-components/compare/v8.13.8-dev...v8.13.9) (2022-08-05)



## [8.13.8](https://github.com/dereekb/dbx-components/compare/v8.13.7-dev...v8.13.8) (2022-08-03)



## [8.13.7](https://github.com/dereekb/dbx-components/compare/v8.13.6-dev...v8.13.7) (2022-08-03)



## [8.13.6](https://github.com/dereekb/dbx-components/compare/v8.13.5-dev...v8.13.6) (2022-08-01)



## [8.13.5](https://github.com/dereekb/dbx-components/compare/v8.13.4-dev...v8.13.5) (2022-07-29)



## [8.13.4](https://github.com/dereekb/dbx-components/compare/v8.13.3-dev...v8.13.4) (2022-07-23)



## [8.13.3](https://github.com/dereekb/dbx-components/compare/v8.13.2-dev...v8.13.3) (2022-07-21)



## [8.13.2](https://github.com/dereekb/dbx-components/compare/v8.13.1-dev...v8.13.2) (2022-07-20)



## [8.13.1](https://github.com/dereekb/dbx-components/compare/v8.13.0-dev...v8.13.1) (2022-07-19)



# [8.13.0](https://github.com/dereekb/dbx-components/compare/v8.12.13-dev...v8.13.0) (2022-07-16)



## [8.12.13](https://github.com/dereekb/dbx-components/compare/v8.12.12-dev...v8.12.13) (2022-07-16)



## [8.12.12](https://github.com/dereekb/dbx-components/compare/v8.12.11-dev...v8.12.12) (2022-07-15)



## [8.12.11](https://github.com/dereekb/dbx-components/compare/v8.12.10-dev...v8.12.11) (2022-07-14)



## [8.12.10](https://github.com/dereekb/dbx-components/compare/v8.12.9-dev...v8.12.10) (2022-07-13)



## [8.12.9](https://github.com/dereekb/dbx-components/compare/v8.12.8-dev...v8.12.9) (2022-07-12)



## [8.12.8](https://github.com/dereekb/dbx-components/compare/v8.12.7-dev...v8.12.8) (2022-07-12)



## [8.12.7](https://github.com/dereekb/dbx-components/compare/v8.12.6-dev...v8.12.7) (2022-07-11)



## [8.12.6](https://github.com/dereekb/dbx-components/compare/v8.12.5-dev...v8.12.6) (2022-07-11)



## [8.12.5](https://github.com/dereekb/dbx-components/compare/v8.12.4-dev...v8.12.5) (2022-07-10)



## [8.12.4](https://github.com/dereekb/dbx-components/compare/v8.12.3-dev...v8.12.4) (2022-07-10)



## [8.12.3](https://github.com/dereekb/dbx-components/compare/v8.12.2-dev...v8.12.3) (2022-07-09)



## [8.12.2](https://github.com/dereekb/dbx-components/compare/v8.12.1-dev...v8.12.2) (2022-07-08)



## [8.12.1](https://github.com/dereekb/dbx-components/compare/v8.12.0-dev...v8.12.1) (2022-07-08)



# [8.12.0](https://github.com/dereekb/dbx-components/compare/v8.11.2-dev...v8.12.0) (2022-07-07)



## [8.11.2](https://github.com/dereekb/dbx-components/compare/v8.11.1-dev...v8.11.2) (2022-07-05)



## [8.11.1](https://github.com/dereekb/dbx-components/compare/v8.11.0-dev...v8.11.1) (2022-07-05)



# [8.11.0](https://github.com/dereekb/dbx-components/compare/v8.10.0-dev...v8.11.0) (2022-07-05)



# [8.10.0](https://github.com/dereekb/dbx-components/compare/v8.9.1-dev...v8.10.0) (2022-07-04)



## [8.9.1](https://github.com/dereekb/dbx-components/compare/v8.9.0-dev...v8.9.1) (2022-06-30)



# [8.9.0](https://github.com/dereekb/dbx-components/compare/v8.8.1-dev...v8.9.0) (2022-06-30)



## [8.8.1](https://github.com/dereekb/dbx-components/compare/v8.8.0-dev...v8.8.1) (2022-06-29)



# [8.8.0](https://github.com/dereekb/dbx-components/compare/v8.7.6-dev...v8.8.0) (2022-06-29)



## [8.7.6](https://github.com/dereekb/dbx-components/compare/v8.7.5-dev...v8.7.6) (2022-06-29)



## [8.7.5](https://github.com/dereekb/dbx-components/compare/v8.7.4-dev...v8.7.5) (2022-06-28)



## [8.7.4](https://github.com/dereekb/dbx-components/compare/v8.7.3-dev...v8.7.4) (2022-06-26)



## [8.7.3](https://github.com/dereekb/dbx-components/compare/v8.7.2-dev...v8.7.3) (2022-06-25)



## [8.7.2](https://github.com/dereekb/dbx-components/compare/v8.7.1-dev...v8.7.2) (2022-06-24)



## [8.7.1](https://github.com/dereekb/dbx-components/compare/v8.7.0-dev...v8.7.1) (2022-06-24)



# [8.7.0](https://github.com/dereekb/dbx-components/compare/v8.6.1-dev...v8.7.0) (2022-06-23)



## [8.6.1](https://github.com/dereekb/dbx-components/compare/v8.6.0-dev...v8.6.1) (2022-06-23)



# [8.6.0](https://github.com/dereekb/dbx-components/compare/v8.5.3-dev...v8.6.0) (2022-06-22)



## [8.5.3](https://github.com/dereekb/dbx-components/compare/v8.5.2-dev...v8.5.3) (2022-06-22)



## [8.5.2](https://github.com/dereekb/dbx-components/compare/v8.5.1-dev...v8.5.2) (2022-06-22)



## [8.5.1](https://github.com/dereekb/dbx-components/compare/v8.5.0-dev...v8.5.1) (2022-06-22)



# [8.5.0](https://github.com/dereekb/dbx-components/compare/v8.4.0-dev...v8.5.0) (2022-06-22)


### Features

* added firestore key validators ([9d090db](https://github.com/dereekb/dbx-components/commit/9d090db1e84b97f11cc2b751dcbe7d2724960b2b))



# [8.4.0](https://github.com/dereekb/dbx-components/compare/v8.3.0-dev...v8.4.0) (2022-06-21)



# [8.3.0](https://github.com/dereekb/dbx-components/compare/v8.2.0-dev...v8.3.0) (2022-06-20)


### Features

* added DbxFirebaseDocumentLoaderInstance ([523d1df](https://github.com/dereekb/dbx-components/commit/523d1dff22ac979b75bd310677770665ec76ff63))



# [8.2.0](https://github.com/dereekb/dbx-components/compare/v8.1.2-dev...v8.2.0) (2022-06-20)


### Features

* added DbxRouteParamDefaultInstance ([2608580](https://github.com/dereekb/dbx-components/commit/26085806ff2578ce2864140fc78e883b399c05e9))
* added DbxRouteParamReader ([a855283](https://github.com/dereekb/dbx-components/commit/a8552835aabbfa85814984a8fdafd7bd1fb2963e))



## [8.1.2](https://github.com/dereekb/dbx-components/compare/v8.1.1-dev...v8.1.2) (2022-06-19)



## [8.1.1](https://github.com/dereekb/dbx-components/compare/v8.1.0-dev...v8.1.1) (2022-06-18)



# [8.1.0](https://github.com/dereekb/dbx-components/compare/v8.0.1-dev...v8.1.0) (2022-06-18)


### Features

* added jest fail test utilities ([#13](https://github.com/dereekb/dbx-components/issues/13)) ([5891777](https://github.com/dereekb/dbx-components/commit/5891777470a339892c8e7045c24b5dea174b1736))



## [8.0.1](https://github.com/dereekb/dbx-components/compare/v8.0.0-dev...v8.0.1) (2022-06-17)



# [8.0.0](https://github.com/dereekb/dbx-components/compare/v7.16.0-dev...v8.0.0) (2022-06-17)



# [7.16.0](https://github.com/dereekb/dbx-components/compare/v7.15.2-dev...v7.16.0) (2022-06-17)



## [7.15.2](https://github.com/dereekb/dbx-components/compare/v7.15.1-dev...v7.15.2) (2022-06-17)



## [7.15.1](https://github.com/dereekb/dbx-components/compare/v7.15.0-dev...v7.15.1) (2022-06-16)



# [7.15.0](https://github.com/dereekb/dbx-components/compare/v7.14.0-dev...v7.15.0) (2022-06-16)



# [7.14.0](https://github.com/dereekb/dbx-components/compare/v7.13.1-dev...v7.14.0) (2022-06-15)



## [7.13.1](https://github.com/dereekb/dbx-components/compare/v7.13.0-dev...v7.13.1) (2022-06-15)



# [7.13.0](https://github.com/dereekb/dbx-components/compare/v7.12.0-dev...v7.13.0) (2022-06-14)



# [7.12.0](https://github.com/dereekb/dbx-components/compare/v7.11.2-dev...v7.12.0) (2022-06-14)



## [7.11.2](https://github.com/dereekb/dbx-components/compare/v7.11.1-dev...v7.11.2) (2022-06-13)



## [7.11.1](https://github.com/dereekb/dbx-components/compare/v7.11.0-dev...v7.11.1) (2022-06-13)



# [7.11.0](https://github.com/dereekb/dbx-components/compare/v7.10.0-dev...v7.11.0) (2022-06-13)



# [7.10.0](https://github.com/dereekb/dbx-components/compare/v7.9.0-dev...v7.10.0) (2022-06-11)



# [7.9.0](https://github.com/dereekb/dbx-components/compare/v7.8.1-dev...v7.9.0) (2022-06-11)



## [7.8.1](https://github.com/dereekb/dbx-components/compare/v7.8.0-dev...v7.8.1) (2022-06-10)



# [7.8.0](https://github.com/dereekb/dbx-components/compare/v7.7.0-dev...v7.8.0) (2022-06-09)



# [7.7.0](https://github.com/dereekb/dbx-components/compare/v7.6.0-dev...v7.7.0) (2022-06-09)



# [7.6.0](https://github.com/dereekb/dbx-components/compare/v7.5.0-dev...v7.6.0) (2022-06-09)



# [7.5.0](https://github.com/dereekb/dbx-components/compare/v7.4.0-dev...v7.5.0) (2022-06-08)



# [7.4.0](https://github.com/dereekb/dbx-components/compare/v7.3.0-dev...v7.4.0) (2022-06-08)



# [7.3.0](https://github.com/dereekb/dbx-components/compare/v7.2.0-dev...v7.3.0) (2022-06-08)


### Features

* added FirestoreMap, FirestoreArrayMap snapshot fields ([bd23fd3](https://github.com/dereekb/dbx-components/commit/bd23fd372e3f2180980d7aec9c1b6ee1ec2bb3c7))



# [7.2.0](https://github.com/dereekb/dbx-components/compare/v7.1.0-dev...v7.2.0) (2022-06-06)



# [7.1.0](https://github.com/dereekb/dbx-components/compare/v7.0.1-dev...v7.1.0) (2022-06-06)



## [7.0.1](https://github.com/dereekb/dbx-components/compare/v7.0.0-dev...v7.0.1) (2022-06-05)



# [7.0.0](https://github.com/dereekb/dbx-components/compare/v6.0.0-dev...v7.0.0) (2022-06-05)



# [6.0.0](https://github.com/dereekb/dbx-components/compare/v5.3.0-dev...v6.0.0) (2022-06-03)


### Bug Fixes

* hasAuthRoleHook fix ([e4749ba](https://github.com/dereekb/dbx-components/commit/e4749bae9a657d7cdc82974d129211392261aa3c))
* hasAuthStateData interface fix ([8ea59e3](https://github.com/dereekb/dbx-components/commit/8ea59e3cba1e0407e6e1ed7b2dd4176a68c2fa09))



# [5.3.0](https://github.com/dereekb/dbx-components/compare/v5.2.1-dev...v5.3.0) (2022-05-30)


### Bug Fixes

* fixed dbxActionEnforceModifiedDirective ([f889b87](https://github.com/dereekb/dbx-components/commit/f889b87463443024c718786e866ad9c9414a3662))



## [5.2.1](https://github.com/dereekb/dbx-components/compare/v5.2.0-dev...v5.2.1) (2022-05-29)



# [5.2.0](https://github.com/dereekb/dbx-components/compare/v5.1.0-dev...v5.2.0) (2022-05-29)



# [5.1.0](https://github.com/dereekb/dbx-components/compare/v5.0.1-dev...v5.1.0) (2022-05-27)



## [5.0.1](https://github.com/dereekb/dbx-components/compare/v5.0.0-dev...v5.0.1) (2022-05-26)



# [5.0.0](https://github.com/dereekb/dbx-components/compare/v4.1.0-dev...v5.0.0) (2022-05-25)



# [4.1.0](https://github.com/dereekb/dbx-components/compare/v4.0.1-dev...v4.1.0) (2022-05-17)


### Features

* setup project ([fe2ae88](https://github.com/dereekb/dbx-components/commit/fe2ae88592c4a02c0346e5e31c72e3d66fb08845))



## [4.0.1](https://github.com/dereekb/dbx-components/compare/v4.0.0-dev...v4.0.1) (2022-05-14)



# [4.0.0](https://github.com/dereekb/dbx-components/compare/v3.0.0...v4.0.0) (2022-05-14)



# [3.0.0](https://github.com/dereekb/dbx-components/compare/v2.1.0...v3.0.0) (2022-05-13)


### Bug Fixes

* fixed createOrUpdateWithAccessor ([243d0d3](https://github.com/dereekb/dbx-components/commit/243d0d3dd83c49171b2f7bea68142c9155f3723d))


### Features

* added AsyncPusher ([8cb2052](https://github.com/dereekb/dbx-components/commit/8cb2052577e0901d2acafa3db724b94ab0035b0a))
* added dbxAppContextState ([dfc17eb](https://github.com/dereekb/dbx-components/commit/dfc17ebfd5281dc0d35b9f5347a1f02d8739c171))
* added dbxAppContextStateModule, dbxAppAuthRouterModule ([40fa1fe](https://github.com/dereekb/dbx-components/commit/40fa1fe9af7ce402e54aac665b9af3c191c9d321))
* added dbxAuthService ([9422182](https://github.com/dereekb/dbx-components/commit/9422182a617d73b4889ce433aa246962739adaf2))
* added dbxCoreAuthModule ([29ebf14](https://github.com/dereekb/dbx-components/commit/29ebf14bc2ce380a7dfafb7d35fd77dfb3d98ea0))
* added dbxFirebaseCollectionChangeDirective ([93a38a2](https://github.com/dereekb/dbx-components/commit/93a38a2be5da3ab5d1bf7905467441fc8b2d563e))
* added dbxFirebaseCollectionStore ([9704c83](https://github.com/dereekb/dbx-components/commit/9704c83603079fe1c58c3961f64d8472ff90bf6d))
* added dbxFirebaseDocumentStore ([43da785](https://github.com/dereekb/dbx-components/commit/43da785b1b271549f65273a56a0c333a0a23bb2e))
* added dbxFirebaseDocumentWithParentStore ([f055d81](https://github.com/dereekb/dbx-components/commit/f055d81aadc8df852640e7997368af73be05b654))
* added dbxInjectionContext ([a6ac801](https://github.com/dereekb/dbx-components/commit/a6ac80106cd78371391c1a314364997bf974194c))
* added dbxProgressButtons ([004ada2](https://github.com/dereekb/dbx-components/commit/004ada21ecb9c92325e76222adf8fc6a0762cad4))
* firebaseServerAuthModule ([db9a4d3](https://github.com/dereekb/dbx-components/commit/db9a4d3d47fd15317186c7a034c25083ae395251))


### BREAKING CHANGES

* renamed dbxInjectedContent to dbxInjection, renamed related content



# [2.1.0](https://github.com/dereekb/dbx-components/compare/v2.0.0...v2.1.0) (2022-03-17)


### Bug Fixes

* dbx-web, dbx-form now export scss in package.json ([c7f7c14](https://github.com/dereekb/dbx-components/commit/c7f7c1485aedfe80243c78435d8b39ece60c3a60))


### Features

* dbxActionDialogDirective ([63fb871](https://github.com/dereekb/dbx-components/commit/63fb8717ea1213b602e34640ec1be81d6ca14098))
* dbxActionPopoverDirective ([a808ac9](https://github.com/dereekb/dbx-components/commit/a808ac9a7b62841311d63df1d1ee55e57876f47f))



# [2.0.0](https://github.com/dereekb/dbx-components/compare/v1.2.0...v2.0.0) (2022-03-13)


### demo

* added docs page for action context ([a8cbf38](https://github.com/dereekb/dbx-components/commit/a8cbf38c631c4c9f837df274192cbb76f861612c))


### Features

* added dbxActionEnforceModified ([5a4c4b2](https://github.com/dereekb/dbx-components/commit/5a4c4b267f95eda02abccc0fb8a9ae6ab910f738))
* added dbxActionLoadingContextDirective ([c20aa02](https://github.com/dereekb/dbx-components/commit/c20aa0283c6d248e623f32b2026077e854ada090))


### BREAKING CHANGES

* Renamed DbxActionState SUCCESS state to RESOLVED



# [1.2.0](https://github.com/dereekb/dbx-components/compare/v1.1.0...v1.2.0) (2022-03-04)



# [1.1.0](https://github.com/dereekb/dbx-components/compare/v1.0.0...v1.1.0) (2022-03-02)



# 1.0.0 (2022-02-23)


### Code Refactoring

* renamed dbNgx prefix to dbx ([a545a76](https://github.com/dereekb/dbx-components/commit/a545a76ed9300b594a3aafe4d89902d18c9d5e3d))


### Features

* added dbxAnchorList ([7901784](https://github.com/dereekb/dbx-components/commit/79017846fbf83a67672bb52c90e52c626ddc1f66))
* added dbxListView ([945be93](https://github.com/dereekb/dbx-components/commit/945be93582c86dc26bcda8718907b7a6bd07deff))
* added dbxNavbar ([8f7d087](https://github.com/dereekb/dbx-components/commit/8f7d087b204f9073fb267eee8d35736168a2da06))
* added dbxSearchableTextFieldComponent ([42ae14c](https://github.com/dereekb/dbx-components/commit/42ae14c7709f6603db676c94f1df2017fdad59ca))
* added dbxSelectionListView ([1b34c02](https://github.com/dereekb/dbx-components/commit/1b34c0203a8ce798f83c404189f7c7fdb0555e95))
* added dbxSidenav ([867ab31](https://github.com/dereekb/dbx-components/commit/867ab3189e1f7356d7b8f6202f0df70a45549d1f))
* added dbxStyle ([38fda5d](https://github.com/dereekb/dbx-components/commit/38fda5d79463bbed09dcd82a4037e8a8c1112a1f))
* added FilterMap ([6ffefce](https://github.com/dereekb/dbx-components/commit/6ffefce8e13efd36adb79ea6f95fb0edafe22f16))


### BREAKING CHANGES

* all services now have the prefix Dbx instead of DbNgx



# 0.1.0 (2022-01-29)
