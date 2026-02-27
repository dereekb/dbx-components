# 13.0.0 (2026-02-27)

### 🚀 Features

- ⚠️  dbx-components v13 ([#33](https://github.com/dereekb/dbx-components/pull/33))

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