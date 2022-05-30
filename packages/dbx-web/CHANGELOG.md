# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

# [5.3.0](https://github.com/dereekb/dbx-components/compare/v5.2.1-dev...v5.3.0) (2022-05-30)


### Bug Fixes

* fixed dbxActionEnforceModifiedDirective ([f889b87](https://github.com/dereekb/dbx-components/commit/f889b87463443024c718786e866ad9c9414a3662))



## [5.2.1](https://github.com/dereekb/dbx-components/compare/v5.2.0-dev...v5.2.1) (2022-05-29)



# [5.2.0](https://github.com/dereekb/dbx-components/compare/v5.1.0-dev...v5.2.0) (2022-05-29)



# [5.1.0](https://github.com/dereekb/dbx-components/compare/v5.0.1-dev...v5.1.0) (2022-05-27)



## [5.0.1](https://github.com/dereekb/dbx-components/compare/v5.0.0-dev...v5.0.1) (2022-05-26)



# [5.0.0](https://github.com/dereekb/dbx-components/compare/v4.1.0-dev...v5.0.0) (2022-05-25)



# [4.1.0](https://github.com/dereekb/dbx-components/compare/v4.0.1-dev...v4.1.0) (2022-05-17)



## [4.0.1](https://github.com/dereekb/dbx-components/compare/v4.0.0-dev...v4.0.1) (2022-05-14)



# [4.0.0](https://github.com/dereekb/dbx-components/compare/v3.0.0...v4.0.0) (2022-05-14)



# [3.0.0](https://github.com/dereekb/dbx-components/compare/v2.1.0...v3.0.0) (2022-05-13)


### Code Refactoring

* renamed value to itemValue in dbxValueListItem ([3441129](https://github.com/dereekb/dbx-components/commit/34411292cf3400fe0aad8872b25d9eba7e4bd062))


### Features

* added dbxAppContextStateModule, dbxAppAuthRouterModule ([40fa1fe](https://github.com/dereekb/dbx-components/commit/40fa1fe9af7ce402e54aac665b9af3c191c9d321))
* added dbxFirebaseCollectionStore ([9704c83](https://github.com/dereekb/dbx-components/commit/9704c83603079fe1c58c3961f64d8472ff90bf6d))
* added dbxFirebaseDocumentStore ([43da785](https://github.com/dereekb/dbx-components/commit/43da785b1b271549f65273a56a0c333a0a23bb2e))
* added dbxFirebaseFunctionsModule ([3d1bc69](https://github.com/dereekb/dbx-components/commit/3d1bc69552e0a3cede0261d4819ad35199a03fa3))
* added dbxFirebaseModelLoaderModule ([15a8052](https://github.com/dereekb/dbx-components/commit/15a8052e057fa6e5691915ab81b5fe8b4afdfa95))
* added dbxInjectionContext ([a6ac801](https://github.com/dereekb/dbx-components/commit/a6ac80106cd78371391c1a314364997bf974194c))
* added dbxListItemDisableRippleModifier ([c89cc82](https://github.com/dereekb/dbx-components/commit/c89cc82b618ae3513c716d09c1e721b8c32e16c6))
* added dbxListItemModifier, dbxListItemAnchorModifier ([a96ffa8](https://github.com/dereekb/dbx-components/commit/a96ffa8e87b49b4408c917b6480d139dc748d8e4))
* added dbxProgressButtons ([004ada2](https://github.com/dereekb/dbx-components/commit/004ada21ecb9c92325e76222adf8fc6a0762cad4))
* dbxSelectionListViewContent can render as dbxListViewContent ([df16297](https://github.com/dereekb/dbx-components/commit/df1629777ec02f3ac96fa0fbcbaa1d4565f7095c))


### BREAKING CHANGES

* renamed value to itemValue to better avoid issues when using DbxValueAsListItem values

- Added DbxValueAsListItem type for those use cases
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

* added dbxActionLoadingContextDirective ([c20aa02](https://github.com/dereekb/dbx-components/commit/c20aa0283c6d248e623f32b2026077e854ada090))


### BREAKING CHANGES

* Renamed DbxActionState SUCCESS state to RESOLVED



# [1.2.0](https://github.com/dereekb/dbx-components/compare/v1.1.0...v1.2.0) (2022-03-04)



# [1.1.0](https://github.com/dereekb/dbx-components/compare/v1.0.0...v1.1.0) (2022-03-02)



# 1.0.0 (2022-02-23)


### Bug Fixes

* removed browserModule imports from dbx-web ([84cbdf2](https://github.com/dereekb/dbx-components/commit/84cbdf26bab41a7c4fc964ca3b74dcf093726a74))


### Code Refactoring

* renamed dbNgx prefix to dbx ([a545a76](https://github.com/dereekb/dbx-components/commit/a545a76ed9300b594a3aafe4d89902d18c9d5e3d))


### Features

* added dbxAnchorList ([7901784](https://github.com/dereekb/dbx-components/commit/79017846fbf83a67672bb52c90e52c626ddc1f66))
* added dbxBar, dbxPagebar, dbxSidenavPage ([4621fff](https://github.com/dereekb/dbx-components/commit/4621fff73424b427a43dde8d68591a4061e661a5))
* added dbxFlexGroup ([a3a85c6](https://github.com/dereekb/dbx-components/commit/a3a85c62c6b07bed895157fdc284b31c5e369da8))
* added dbxList ([83ddb00](https://github.com/dereekb/dbx-components/commit/83ddb006548602640ec312594b9bb9f26f3417de))
* added dbxListView ([945be93](https://github.com/dereekb/dbx-components/commit/945be93582c86dc26bcda8718907b7a6bd07deff))
* added dbxNavbar ([8f7d087](https://github.com/dereekb/dbx-components/commit/8f7d087b204f9073fb267eee8d35736168a2da06))
* added dbxPickableChipListFieldComponent ([285b492](https://github.com/dereekb/dbx-components/commit/285b492a2669ce1d2ba6d4f6cbf1570cb0cb4ee7))
* added dbxScreenService ([2adf092](https://github.com/dereekb/dbx-components/commit/2adf092e7b8d7dd41ccc1ca9f3ebcb2de37ec92f))
* added dbxSearchableTextFieldComponent ([42ae14c](https://github.com/dereekb/dbx-components/commit/42ae14c7709f6603db676c94f1df2017fdad59ca))
* added dbxSelectionListView ([1b34c02](https://github.com/dereekb/dbx-components/commit/1b34c0203a8ce798f83c404189f7c7fdb0555e95))
* added dbxSidenav ([867ab31](https://github.com/dereekb/dbx-components/commit/867ab3189e1f7356d7b8f6202f0df70a45549d1f))
* added dbxStyle ([38fda5d](https://github.com/dereekb/dbx-components/commit/38fda5d79463bbed09dcd82a4037e8a8c1112a1f))
* added dbxStyleBody ([5b624ae](https://github.com/dereekb/dbx-components/commit/5b624ae0c77ea935fe874dcb977eb22dd17cd60c))
* added dbxTextEditorFieldComponent ([9146403](https://github.com/dereekb/dbx-components/commit/9146403e26e7647181f66435db3597f0f64853ec))
* added FilterMap ([6ffefce](https://github.com/dereekb/dbx-components/commit/6ffefce8e13efd36adb79ea6f95fb0edafe22f16))


### BREAKING CHANGES

* all services now have the prefix Dbx instead of DbNgx



# 0.1.0 (2022-01-29)
