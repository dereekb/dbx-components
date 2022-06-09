# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

# [7.8.0](https://github.com/dereekb/dbx-components/compare/v7.7.0-dev...v7.8.0) (2022-06-09)


### Bug Fixes

* firestoreEnum test fix ([5996b79](https://github.com/dereekb/dbx-components/commit/5996b79c292aaed67137738ac95652dce81060c7))


### Features

* added firestoreEnum() ([28e6704](https://github.com/dereekb/dbx-components/commit/28e670414f87eb538e996c5d823b5f79e9d9ae97))
* added firestoreEnumArray() ([5f9e1b1](https://github.com/dereekb/dbx-components/commit/5f9e1b14237ff229a4a832b8fbd5f13a21f753a6))



# [7.7.0](https://github.com/dereekb/dbx-components/compare/v7.6.0-dev...v7.7.0) (2022-06-09)


### Bug Fixes

* documentAccessorForTransaction/WriteBatch now accepts a Maybe value ([beb1737](https://github.com/dereekb/dbx-components/commit/beb173794ce2cf60b41e43ccfc2b4e4eeda53224))
* fixed grantFullAccessIfAuthUserRelated typings ([f83af85](https://github.com/dereekb/dbx-components/commit/f83af852f1fbad20ba86eb477d18f54e936dd41c))
* grantFullAccessIfAuthUserRelated() now takes in a document or model ([53563dd](https://github.com/dereekb/dbx-components/commit/53563dd93a9ae25e84b6ef7f3e9d7ce857254bc6))


### Features

* added useDocumentSnapshotData ([aa329f2](https://github.com/dereekb/dbx-components/commit/aa329f25cb105c871bc0fb22001abb7a98979b14))



# [7.6.0](https://github.com/dereekb/dbx-components/compare/v7.5.0-dev...v7.6.0) (2022-06-09)


### Features

* added grantFullAccessIfAuthUserRelated() ([be05e09](https://github.com/dereekb/dbx-components/commit/be05e0939939e9e0d1c8d1d8afbcab1fb15e060b))



# [7.5.0](https://github.com/dereekb/dbx-components/compare/v7.4.0-dev...v7.5.0) (2022-06-08)


### Bug Fixes

* updated GrantRolesOtherwiseFunction to allow returning Maybe ([552bb9c](https://github.com/dereekb/dbx-components/commit/552bb9c488c0f11aa1aca885d00c5a7c2a199591))


### Features

* added UseFunction, MappedUseFunction ([84b6cbe](https://github.com/dereekb/dbx-components/commit/84b6cbe23b7e020ad7de49633642429d7e32f7d4))



# [7.4.0](https://github.com/dereekb/dbx-components/compare/v7.3.0-dev...v7.4.0) (2022-06-08)


### Features

* added grantModelRolesIfFunction and related types ([5432fab](https://github.com/dereekb/dbx-components/commit/5432fab1677c29e24eac4015c35821aba2d64e10))
* updated FirebaseServerAuthUserContext to be synchronous ([92bfd84](https://github.com/dereekb/dbx-components/commit/92bfd849b4a6d6773c616069c3085b686938ef4d))



# [7.3.0](https://github.com/dereekb/dbx-components/compare/v7.2.0-dev...v7.3.0) (2022-06-08)


### Features

* added FirestoreMap, FirestoreArrayMap snapshot fields ([bd23fd3](https://github.com/dereekb/dbx-components/commit/bd23fd372e3f2180980d7aec9c1b6ee1ec2bb3c7))



# [7.2.0](https://github.com/dereekb/dbx-components/compare/v7.1.0-dev...v7.2.0) (2022-06-06)


### Features

* firestoreModeIdentity can now accept a collection name ([1e0646e](https://github.com/dereekb/dbx-components/commit/1e0646e598a0834d8b4c3d264bb5ee42626e9fc7))



# [7.1.0](https://github.com/dereekb/dbx-components/compare/v7.0.1-dev...v7.1.0) (2022-06-06)


### Features

* added firestoreArray ([e852230](https://github.com/dereekb/dbx-components/commit/e85223077246c1755cdb1028deea7019a6c71206))
* added firestoreEncodedArray, firestoreUniqueArray ([4f7fc7c](https://github.com/dereekb/dbx-components/commit/4f7fc7ca274656ecdf13d69aa7d225f66a7f76da))
* added interceptAccessorFactory() ([9833539](https://github.com/dereekb/dbx-components/commit/98335398eaa6a3ee363bdf64a440d5438bbefb24))
* added loadDocumentForId() to FirestoreDocumentAccessor ([3728145](https://github.com/dereekb/dbx-components/commit/372814540064ff4b40be032d57ddda12a8698d53))
* added whereDocumentId() ([7f5f5b8](https://github.com/dereekb/dbx-components/commit/7f5f5b8a56b2e0ad2e43308cfd87b4f8b8503c59))



## [7.0.1](https://github.com/dereekb/dbx-components/compare/v7.0.0-dev...v7.0.1) (2022-06-05)



# [7.0.0](https://github.com/dereekb/dbx-components/compare/v6.0.0-dev...v7.0.0) (2022-06-05)


### Features

* added FirestoreDocumentStore crud functions ([7786a40](https://github.com/dereekb/dbx-components/commit/7786a40f6033c2a1d5161805cde283dca7323db5))
* added onCallCreateModel ([84f7e72](https://github.com/dereekb/dbx-components/commit/84f7e72af20c1d0071feec3e46bae406d7fd5a26))
* added useModel to AbstractFirebaseNestContext ([29c1940](https://github.com/dereekb/dbx-components/commit/29c19402bff78d743d28ef88093757844f8ee5f7))



# [6.0.0](https://github.com/dereekb/dbx-components/compare/v5.3.0-dev...v6.0.0) (2022-06-03)


### Features

* added AbstractFirebaseNestContext ([2f8e1a2](https://github.com/dereekb/dbx-components/commit/2f8e1a2127ffcfb23a428d6b46192633d8bf725f))
* added ContextGrantedModelRolesReader ([6fba1cc](https://github.com/dereekb/dbx-components/commit/6fba1cc637beeff55523df599eb88391352f9f58))
* added FirebaseModelService ([3876575](https://github.com/dereekb/dbx-components/commit/387657559a86908eee57326b655c63a0a836c239))
* added FirebaseModelsPermissionService ([9d75de4](https://github.com/dereekb/dbx-components/commit/9d75de4052dcfb15ef680d30f476ef494d8328a9))
* added firebaseModelsService ([7432e55](https://github.com/dereekb/dbx-components/commit/7432e55111cec66a239856ecb2db6adfc9e9780d))
* added InModelContextFirebaseModelServiceFactory ([9bf4697](https://github.com/dereekb/dbx-components/commit/9bf469731699a16ad27c96e3b149f552a429b471))
* added loadDocumentForKey to LimitedFirestoreDocumentAccessor ([96958b8](https://github.com/dereekb/dbx-components/commit/96958b89df62dc38136ac2dfcd2ce7c139b6099e))
* added modelType to FirestoreDocument ([deecb5d](https://github.com/dereekb/dbx-components/commit/deecb5df415ed9d99412c336ba65f4da572bbe44))
* added OnCallDeleteModel ([358189d](https://github.com/dereekb/dbx-components/commit/358189d6db6ef7d8db93d6dd881d29cc724dd083))
* added OnCallUpdateModel ([3b60a06](https://github.com/dereekb/dbx-components/commit/3b60a06d48ec6a96940f44939e24e5c1f4879aa9))
* added orderByDocumentId, startAtValue, endAtValue constraints ([c846fee](https://github.com/dereekb/dbx-components/commit/c846feef6c26a3818bb006a807b6e931b7b14eaf))


### BREAKING CHANGES

* model type is now required on FirestoreDocument models



# [5.3.0](https://github.com/dereekb/dbx-components/compare/v5.2.1-dev...v5.3.0) (2022-05-30)



## [5.2.1](https://github.com/dereekb/dbx-components/compare/v5.2.0-dev...v5.2.1) (2022-05-29)



# [5.2.0](https://github.com/dereekb/dbx-components/compare/v5.1.0-dev...v5.2.0) (2022-05-29)


### Features

* added collection group support to dbx-firebase components ([9f746c1](https://github.com/dereekb/dbx-components/commit/9f746c12a0e219970dcde12d920f1ef540514ce9))
* added firestore collection group support ([3b4c4cf](https://github.com/dereekb/dbx-components/commit/3b4c4cfa1dd860604c347ade69acdc2fea1063f8))



# [5.1.0](https://github.com/dereekb/dbx-components/compare/v5.0.1-dev...v5.1.0) (2022-05-27)



## [5.0.1](https://github.com/dereekb/dbx-components/compare/v5.0.0-dev...v5.0.1) (2022-05-26)


### Bug Fixes

* setup-project fixes ([d700370](https://github.com/dereekb/dbx-components/commit/d700370301483b64cf561ab3fe9b0492c697cd45))



# [5.0.0](https://github.com/dereekb/dbx-components/compare/v4.1.0-dev...v5.0.0) (2022-05-25)


### Code Refactoring

* refactored @dereekb/firebase snapshot field ([c88d278](https://github.com/dereekb/dbx-components/commit/c88d2780d66f965a41ae299e013109f6860e9496))


### Features

* added @dereekb/nestjs/stripe ([455f20e](https://github.com/dereekb/dbx-components/commit/455f20e4e6402b3d517e7857fb93ec82eb25817b))


### BREAKING CHANGES

* refactored @dereekb/firebase SnapshotConverterFunction and related components and @dereekb/util model conversion components to have better type safety and inference



# [4.1.0](https://github.com/dereekb/dbx-components/compare/v4.0.1-dev...v4.1.0) (2022-05-17)


### Bug Fixes

* fixed package.json exports for util, firebase, and firebase-server ([04c1d9a](https://github.com/dereekb/dbx-components/commit/04c1d9ab56dd2805aac154f7bf139ebca7dc4fb9))


### Features

* setup project ([fe2ae88](https://github.com/dereekb/dbx-components/commit/fe2ae88592c4a02c0346e5e31c72e3d66fb08845))



## [4.0.1](https://github.com/dereekb/dbx-components/compare/v4.0.0-dev...v4.0.1) (2022-05-14)



# [4.0.0](https://github.com/dereekb/dbx-components/compare/v3.0.0...v4.0.0) (2022-05-14)



# [3.0.0](https://github.com/dereekb/dbx-components/compare/v2.1.0...v3.0.0) (2022-05-13)


### Bug Fixes

* fixed createOrUpdateWithAccessor ([243d0d3](https://github.com/dereekb/dbx-components/commit/243d0d3dd83c49171b2f7bea68142c9155f3723d))


### Code Refactoring

* renamed conversionFunction to mapFunction ([6aeba77](https://github.com/dereekb/dbx-components/commit/6aeba7721dfd2721d5fe41216a1b81117be80aff))


### Features

* added dbxFirebaseCollectionChangeDirective ([93a38a2](https://github.com/dereekb/dbx-components/commit/93a38a2be5da3ab5d1bf7905467441fc8b2d563e))
* added dbxFirebaseCollectionWithParentStore ([b7045e7](https://github.com/dereekb/dbx-components/commit/b7045e7612326a8fee301a298654f221e3668ab0))
* added dbxFirebaseDocumentStore ([43da785](https://github.com/dereekb/dbx-components/commit/43da785b1b271549f65273a56a0c333a0a23bb2e))
* added dbxFirebaseFunctionsModule ([3d1bc69](https://github.com/dereekb/dbx-components/commit/3d1bc69552e0a3cede0261d4819ad35199a03fa3))
* added dbxFirebaseModelLoaderModule ([15a8052](https://github.com/dereekb/dbx-components/commit/15a8052e057fa6e5691915ab81b5fe8b4afdfa95))
* added firebase-server ([676cf9e](https://github.com/dereekb/dbx-components/commit/676cf9e6c44aab5ca993b5a1a9c347c021b41a4a))
* added firebaseQueryItemAccumulator ([1e4e0f3](https://github.com/dereekb/dbx-components/commit/1e4e0f367a4bdc9dac7366ae9421e9ec48279b92))
* added IterationQueryChangeWatcher ([f5b2474](https://github.com/dereekb/dbx-components/commit/f5b2474f9a2cf659cdebf19ba49055e5bd2f1c90))
* added modelConversionOptions to modelMapFunction ([2de30e0](https://github.com/dereekb/dbx-components/commit/2de30e07527bbaf27c51a8472054a35e73d2ae2b))
* added modelTestContextFactory ([0a96442](https://github.com/dereekb/dbx-components/commit/0a9644252ffc670cb2e861a4c02ace6790eeae52))
* added snapshotConverter, firestoreField ([e986026](https://github.com/dereekb/dbx-components/commit/e986026a4a4700c734fe1534778945df189c518d))


### BREAKING CHANGES

* - renamed flattenIterationResultItemArray to flattenAccumulatorResultItemArray since the input is an accumulator and not an iteration
* renamed ConversionFunction (and related types) to MapFunction



# [2.1.0](https://github.com/dereekb/dbx-components/compare/v2.0.0...v2.1.0) (2022-03-17)



# [2.0.0](https://github.com/dereekb/dbx-components/compare/v1.2.0...v2.0.0) (2022-03-13)



# [1.2.0](https://github.com/dereekb/dbx-components/compare/v1.1.0...v1.2.0) (2022-03-04)



# [1.1.0](https://github.com/dereekb/dbx-components/compare/v1.0.0...v1.1.0) (2022-03-02)



# 1.0.0 (2022-02-23)



# 0.1.0 (2022-01-29)
