# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

# [5.2.0](https://github.com/dereekb/dbx-components/compare/v5.1.0-dev...v5.2.0) (2022-05-29)



# [5.1.0](https://github.com/dereekb/dbx-components/compare/v5.0.1-dev...v5.1.0) (2022-05-27)


### Features

* added dbxFirebaseAppCheckHttpInterceptor ([96fb516](https://github.com/dereekb/dbx-components/commit/96fb5160a8131d4b13e434bcb3e93819122e1d6f))



## [5.0.1](https://github.com/dereekb/dbx-components/compare/v5.0.0-dev...v5.0.1) (2022-05-26)


### Bug Fixes

* setup-project fixes ([d700370](https://github.com/dereekb/dbx-components/commit/d700370301483b64cf561ab3fe9b0492c697cd45))



# [5.0.0](https://github.com/dereekb/dbx-components/compare/v4.1.0-dev...v5.0.0) (2022-05-25)


### Code Refactoring

* refactored @dereekb/firebase snapshot field ([c88d278](https://github.com/dereekb/dbx-components/commit/c88d2780d66f965a41ae299e013109f6860e9496))


### Features

* added @dereekb/nestjs/stripe ([455f20e](https://github.com/dereekb/dbx-components/commit/455f20e4e6402b3d517e7857fb93ec82eb25817b))
* added catchAllHandlerKey to handler ([ab93b06](https://github.com/dereekb/dbx-components/commit/ab93b06034dafc27f17cfe3d488ca084b931fabc))
* added handlerFunction ([7cd2517](https://github.com/dereekb/dbx-components/commit/7cd25174d273f8e501e13ca02607a8c743adb939))
* codedError now includes original error if available ([1262281](https://github.com/dereekb/dbx-components/commit/1262281f08b75000f863b483744418378006b2d2))


### BREAKING CHANGES

* refactored @dereekb/firebase SnapshotConverterFunction and related components and @dereekb/util model conversion components to have better type safety and inference



# [4.1.0](https://github.com/dereekb/dbx-components/compare/v4.0.1-dev...v4.1.0) (2022-05-17)


### Bug Fixes

* fixed package.json exports for util, firebase, and firebase-server ([04c1d9a](https://github.com/dereekb/dbx-components/commit/04c1d9ab56dd2805aac154f7bf139ebca7dc4fb9))



## [4.0.1](https://github.com/dereekb/dbx-components/compare/v4.0.0-dev...v4.0.1) (2022-05-14)



# [4.0.0](https://github.com/dereekb/dbx-components/compare/v3.0.0...v4.0.0) (2022-05-14)



# [3.0.0](https://github.com/dereekb/dbx-components/compare/v2.1.0...v3.0.0) (2022-05-13)


### Code Refactoring

* renamed conversionFunction to mapFunction ([6aeba77](https://github.com/dereekb/dbx-components/commit/6aeba7721dfd2721d5fe41216a1b81117be80aff))


### Features

* added AsyncPusher ([8cb2052](https://github.com/dereekb/dbx-components/commit/8cb2052577e0901d2acafa3db724b94ab0035b0a))
* added cleanup() ([1885463](https://github.com/dereekb/dbx-components/commit/18854634041fcdf613ea8f8b0640db9fb218bbce))
* added dbxFirebaseDocumentStore ([43da785](https://github.com/dereekb/dbx-components/commit/43da785b1b271549f65273a56a0c333a0a23bb2e))
* added dbxListItemModifier, dbxListItemAnchorModifier ([a96ffa8](https://github.com/dereekb/dbx-components/commit/a96ffa8e87b49b4408c917b6480d139dc748d8e4))
* added isAllowed ([c2a70bf](https://github.com/dereekb/dbx-components/commit/c2a70bf8a6f4bc4ef8b870691b9899fed3cbafad))
* added IterationQueryChangeWatcher ([f5b2474](https://github.com/dereekb/dbx-components/commit/f5b2474f9a2cf659cdebf19ba49055e5bd2f1c90))
* added jestFunctionFixture ([1ea2d7d](https://github.com/dereekb/dbx-components/commit/1ea2d7d4c852449f34279eeedfadd2d69c1e7f2b))
* added mapKeysIntersection utility functions ([f694f86](https://github.com/dereekb/dbx-components/commit/f694f86b87e646e00e446236bb1c94a28652aa70))
* added modelConversionFunctions ([42050a8](https://github.com/dereekb/dbx-components/commit/42050a8c1561acad97e99d540834d9c1305ca897))
* added modelConversionOptions to modelMapFunction ([2de30e0](https://github.com/dereekb/dbx-components/commit/2de30e07527bbaf27c51a8472054a35e73d2ae2b))
* added setContainsAllValues ([737c1e7](https://github.com/dereekb/dbx-components/commit/737c1e750a9c656406043e2a69bdceaf941750b6))
* added snapshotConverter, firestoreField ([e986026](https://github.com/dereekb/dbx-components/commit/e986026a4a4700c734fe1534778945df189c518d))
* firebaseServerAuthModule ([db9a4d3](https://github.com/dereekb/dbx-components/commit/db9a4d3d47fd15317186c7a034c25083ae395251))


### BREAKING CHANGES

* renamed ConversionFunction (and related types) to MapFunction



# [2.1.0](https://github.com/dereekb/dbx-components/compare/v2.0.0...v2.1.0) (2022-03-17)



# [2.0.0](https://github.com/dereekb/dbx-components/compare/v1.2.0...v2.0.0) (2022-03-13)


### Features

* added dbxActionFormDisabledWhileWorking to dbxActionForm ([4d6d67b](https://github.com/dereekb/dbx-components/commit/4d6d67b3b21b57baefa280ad3a72ac2b281e0a19))
* added now to dbxDateTimeFieldComponent ([812e704](https://github.com/dereekb/dbx-components/commit/812e704b9bf44daa7441f236d6fe1e2c499ec7dd))



# [1.2.0](https://github.com/dereekb/dbx-components/compare/v1.1.0...v1.2.0) (2022-03-04)


### Features

* added setContainsAnyValue() ([ea0ee9a](https://github.com/dereekb/dbx-components/commit/ea0ee9a76fc6b093b2608356179e9f633fc896be))



# [1.1.0](https://github.com/dereekb/dbx-components/compare/v1.0.0...v1.1.0) (2022-03-02)



# 1.0.0 (2022-02-23)


### Features

* added dbxList ([83ddb00](https://github.com/dereekb/dbx-components/commit/83ddb006548602640ec312594b9bb9f26f3417de))
* added dbxSearchableTextFieldComponent ([42ae14c](https://github.com/dereekb/dbx-components/commit/42ae14c7709f6603db676c94f1df2017fdad59ca))
* added dbxStyleBody ([5b624ae](https://github.com/dereekb/dbx-components/commit/5b624ae0c77ea935fe874dcb977eb22dd17cd60c))
* added makeBestFit() ([b0cf900](https://github.com/dereekb/dbx-components/commit/b0cf900247ab0490fcb35f845cefecc82e45332b))
* added treeNode ([1aa120f](https://github.com/dereekb/dbx-components/commit/1aa120f7f8c83ccc46d440b77fbd234dec564aea))
* segment analytics ([b81d5a6](https://github.com/dereekb/dbx-components/commit/b81d5a6a70ecf3bc35852d441cfd79e91e5dcb51))



# 0.1.0 (2022-01-29)
