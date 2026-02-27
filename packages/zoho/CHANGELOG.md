# 13.0.0 (2026-02-27)

### 🚀 Features

- ⚠️  dbx-components v13 ([#33](https://github.com/dereekb/dbx-components/pull/33))
- zoho crm ([#32](https://github.com/dereekb/dbx-components/pull/32))
- zoom api ([#29](https://github.com/dereekb/dbx-components/pull/29))
- angular 18 ([#28](https://github.com/dereekb/dbx-components/pull/28))
- notifications ([#27](https://github.com/dereekb/dbx-components/pull/27))
- zoho recruit ([#26](https://github.com/dereekb/dbx-components/pull/26))

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


### Features

* zoho crm ([#32](https://github.com/dereekb/dbx-components/issues/32)) ([abe424b](https://github.com/dereekb/dbx-components/commit/abe424b4ee58cef605a29a5839a2e36d22d24866))



## [12.6.21](https://github.com/dereekb/dbx-components/compare/v12.6.20-dev...v12.6.21) (2026-02-19)



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


### Features

* zoom api ([#29](https://github.com/dereekb/dbx-components/issues/29)) ([555a82a](https://github.com/dereekb/dbx-components/commit/555a82a321c82884d51bcff8bd54ad8c7b4e9f17))



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



# [10.2.0](https://github.com/dereekb/dbx-components/compare/v10.1.30-dev...v10.2.0) (2024-11-07)


### Features

* zoho recruit ([#26](https://github.com/dereekb/dbx-components/issues/26)) ([8e028fd](https://github.com/dereekb/dbx-components/commit/8e028fd6fc57fb276ce04d37ce010fb5a42d4157))



# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).
