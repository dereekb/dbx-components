# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

## [7.8.1](https://github.com/dereekb/dbx-components/compare/v7.8.0-dev...v7.8.1) (2022-06-10)



# [7.8.0](https://github.com/dereekb/dbx-components/compare/v7.7.0-dev...v7.8.0) (2022-06-09)



# [7.7.0](https://github.com/dereekb/dbx-components/compare/v7.6.0-dev...v7.7.0) (2022-06-09)


### Bug Fixes

* grantFullAccessIfAuthUserRelated() now takes in a document or model ([53563dd](https://github.com/dereekb/dbx-components/commit/53563dd93a9ae25e84b6ef7f3e9d7ce857254bc6))



# [7.6.0](https://github.com/dereekb/dbx-components/compare/v7.5.0-dev...v7.6.0) (2022-06-09)



# [7.5.0](https://github.com/dereekb/dbx-components/compare/v7.4.0-dev...v7.5.0) (2022-06-08)



# [7.4.0](https://github.com/dereekb/dbx-components/compare/v7.3.0-dev...v7.4.0) (2022-06-08)



# [7.3.0](https://github.com/dereekb/dbx-components/compare/v7.2.0-dev...v7.3.0) (2022-06-08)



# [7.2.0](https://github.com/dereekb/dbx-components/compare/v7.1.0-dev...v7.2.0) (2022-06-06)



# [7.1.0](https://github.com/dereekb/dbx-components/compare/v7.0.1-dev...v7.1.0) (2022-06-06)


### Features

* added firestoreEncodedArray, firestoreUniqueArray ([4f7fc7c](https://github.com/dereekb/dbx-components/commit/4f7fc7ca274656ecdf13d69aa7d225f66a7f76da))
* added loadDocumentForId() to FirestoreDocumentAccessor ([3728145](https://github.com/dereekb/dbx-components/commit/372814540064ff4b40be032d57ddda12a8698d53))



## [7.0.1](https://github.com/dereekb/dbx-components/compare/v7.0.0-dev...v7.0.1) (2022-06-05)



# [7.0.0](https://github.com/dereekb/dbx-components/compare/v6.0.0-dev...v7.0.0) (2022-06-05)


### Code Refactoring

* updated OnCallWithNestContextRequest to use single object ([2ef4002](https://github.com/dereekb/dbx-components/commit/2ef4002153d3e4b7efb012e31b2739378ac49789))


### Features

* added onCallCreateModel ([84f7e72](https://github.com/dereekb/dbx-components/commit/84f7e72af20c1d0071feec3e46bae406d7fd5a26))
* added useModel to AbstractFirebaseNestContext ([29c1940](https://github.com/dereekb/dbx-components/commit/29c19402bff78d743d28ef88093757844f8ee5f7))


### BREAKING CHANGES

* updated all onCall and functions to now use a single request object instead of multiple parameters



# [6.0.0](https://github.com/dereekb/dbx-components/compare/v5.3.0-dev...v6.0.0) (2022-06-03)


### Features

* added AbstractFirebaseNestContext ([2f8e1a2](https://github.com/dereekb/dbx-components/commit/2f8e1a2127ffcfb23a428d6b46192633d8bf725f))
* added ContextGrantedModelRolesReader ([6fba1cc](https://github.com/dereekb/dbx-components/commit/6fba1cc637beeff55523df599eb88391352f9f58))
* added FirebaseModelsPermissionService ([9d75de4](https://github.com/dereekb/dbx-components/commit/9d75de4052dcfb15ef680d30f476ef494d8328a9))
* added OnCallDeleteModel ([358189d](https://github.com/dereekb/dbx-components/commit/358189d6db6ef7d8db93d6dd881d29cc724dd083))
* added OnCallUpdateModel ([3b60a06](https://github.com/dereekb/dbx-components/commit/3b60a06d48ec6a96940f44939e24e5c1f4879aa9))



# [5.3.0](https://github.com/dereekb/dbx-components/compare/v5.2.1-dev...v5.3.0) (2022-05-30)


### Features

* added authRolesObsWithClaimsService ([10055ae](https://github.com/dereekb/dbx-components/commit/10055ae9f4260211b291419134ba637e9f902893))



## [5.2.1](https://github.com/dereekb/dbx-components/compare/v5.2.0-dev...v5.2.1) (2022-05-29)



# [5.2.0](https://github.com/dereekb/dbx-components/compare/v5.1.0-dev...v5.2.0) (2022-05-29)



# [5.1.0](https://github.com/dereekb/dbx-components/compare/v5.0.1-dev...v5.1.0) (2022-05-27)


### Bug Fixes

* added project context to all firebase cli calls ([9b7fd20](https://github.com/dereekb/dbx-components/commit/9b7fd202f12ca303e171657b1d74ec7f4f6c0105))


### Features

* added FirebaseAppCheckMiddleware ([25ddc4e](https://github.com/dereekb/dbx-components/commit/25ddc4e7ae18d6ef96c38ed529c71313884b7544))
* updated .env deployment to demo-api ([d88ea62](https://github.com/dereekb/dbx-components/commit/d88ea620c9593e0073f323f4536bcccd2de01e2f))



## [5.0.1](https://github.com/dereekb/dbx-components/compare/v5.0.0-dev...v5.0.1) (2022-05-26)


### Bug Fixes

* setup-project fixes ([d700370](https://github.com/dereekb/dbx-components/commit/d700370301483b64cf561ab3fe9b0492c697cd45))



# [5.0.0](https://github.com/dereekb/dbx-components/compare/v4.1.0-dev...v5.0.0) (2022-05-25)


### Code Refactoring

* refactored @dereekb/firebase snapshot field ([c88d278](https://github.com/dereekb/dbx-components/commit/c88d2780d66f965a41ae299e013109f6860e9496))


### Features

* added firebase functions v2 nest context components ([e5ca892](https://github.com/dereekb/dbx-components/commit/e5ca89250c7b7cf99f75d8edb0fc16a4618cbc21))
* added nginx docker configuration for webhooks ([9425016](https://github.com/dereekb/dbx-components/commit/9425016eb5d497144d88dccf2a715b795dcc47ae))
* improved serve-server ([0e6fb18](https://github.com/dereekb/dbx-components/commit/0e6fb186add4dc003660d4501200de40ca911b20))


### BREAKING CHANGES

* refactored @dereekb/firebase SnapshotConverterFunction and related components and @dereekb/util model conversion components to have better type safety and inference



# [4.1.0](https://github.com/dereekb/dbx-components/compare/v4.0.1-dev...v4.1.0) (2022-05-17)


### Features

* setup project ([fe2ae88](https://github.com/dereekb/dbx-components/commit/fe2ae88592c4a02c0346e5e31c72e3d66fb08845))



## [4.0.1](https://github.com/dereekb/dbx-components/compare/v4.0.0-dev...v4.0.1) (2022-05-14)



# [4.0.0](https://github.com/dereekb/dbx-components/compare/v3.0.0...v4.0.0) (2022-05-14)


### Bug Fixes

* fixed createOrUpdateWithAccessor ([243d0d3](https://github.com/dereekb/dbx-components/commit/243d0d3dd83c49171b2f7bea68142c9155f3723d))


### Features

* added dbxFirebaseFunctionsModule ([3d1bc69](https://github.com/dereekb/dbx-components/commit/3d1bc69552e0a3cede0261d4819ad35199a03fa3))
* added dbxListItemDisableRippleModifier ([c89cc82](https://github.com/dereekb/dbx-components/commit/c89cc82b618ae3513c716d09c1e721b8c32e16c6))
* added jestFunctionFixture ([1ea2d7d](https://github.com/dereekb/dbx-components/commit/1ea2d7d4c852449f34279eeedfadd2d69c1e7f2b))
* added modelConversionOptions to modelMapFunction ([2de30e0](https://github.com/dereekb/dbx-components/commit/2de30e07527bbaf27c51a8472054a35e73d2ae2b))
* added modelTestContextFactory ([0a96442](https://github.com/dereekb/dbx-components/commit/0a9644252ffc670cb2e861a4c02ace6790eeae52))
* added onCallWithNestContext to firebase-server ([ad4fcf8](https://github.com/dereekb/dbx-components/commit/ad4fcf80e71e7b954197dd89924d31180c03c911))
* firebaseServerAuthModule ([db9a4d3](https://github.com/dereekb/dbx-components/commit/db9a4d3d47fd15317186c7a034c25083ae395251))



# [2.1.0](https://github.com/dereekb/dbx-components/compare/v2.0.0...v2.1.0) (2022-03-17)


### Features

* dbxActionPopoverDirective ([a808ac9](https://github.com/dereekb/dbx-components/commit/a808ac9a7b62841311d63df1d1ee55e57876f47f))



# [2.0.0](https://github.com/dereekb/dbx-components/compare/v1.2.0...v2.0.0) (2022-03-13)



# [1.2.0](https://github.com/dereekb/dbx-components/compare/v1.1.0...v1.2.0) (2022-03-04)



# [1.1.0](https://github.com/dereekb/dbx-components/compare/v1.0.0...v1.1.0) (2022-03-02)



# 1.0.0 (2022-02-23)



# 0.1.0 (2022-01-29)
