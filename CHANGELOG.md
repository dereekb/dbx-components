## [13.12.6](https://github.com/dereekb/dbx-components/compare/v13.12.5-dev...v13.12.6) (2026-05-29)


### Bug Fixes

- **nestjs:** skip discord autoLogin for placeholder token + tests ([cc372daa](https://github.com/dereekb/dbx-components/commit/cc372daa5989baa7142311366683b028f6e14d92))
- **tools:** peer-dep scanner skips strings and template content ([2aef6a26](https://github.com/dereekb/dbx-components/commit/2aef6a26f9c81f82f85f534f953ab92125774a1d))


### Code Refactoring

- add action-workable token + pdf-merge upload sync ([5dc5a8cd](https://github.com/dereekb/dbx-components/commit/5dc5a8cd1ae60cfa70caece7637d835b17d11bd2))

## [13.12.5](https://github.com/dereekb/dbx-components/compare/v13.12.4-dev...v13.12.5) (2026-05-29)


### Build System

- lint fix + mcp regeneration + firestore indexes ([a6283586](https://github.com/dereekb/dbx-components/commit/a628358602874ecd84f0d128bd2e36aa21ea5c31))


### Code Refactoring

- **dbx-web:** pdf-merge upload via interceptor + action bridge ([9ee755b4](https://github.com/dereekb/dbx-components/commit/9ee755b4e6fa79c4ea7f73d796517e11c09d925b))
- detect @dbxModelApiParams + admin-only api tag ([11e60c98](https://github.com/dereekb/dbx-components/commit/11e60c9891521074c50e4553f7199c14cf4635ed))
- **firebase-eslint:** add api spec-naming rules ([e56d8cac](https://github.com/dereekb/dbx-components/commit/e56d8cacdbd17ce22ff95a33d2c83d0b6bc61658))
- **firebase:** add FirebaseAuthOobCodeDataPair encode/decode ([bb5229b4](https://github.com/dereekb/dbx-components/commit/bb5229b42abe2b5e4de48d975d74bfdc3cc11bd3))
- **firebase:** derive auth method union from typeof consts ([20222068](https://github.com/dereekb/dbx-components/commit/20222068be11b20db89e2852df72e0f07c1bf5b8))
- **firebase:** tag error utils + updateUser known errors ([01adcdff](https://github.com/dereekb/dbx-components/commit/01adcdff93f1883124a7968c258d07090ce7fd4e))

## [13.12.4](https://github.com/dereekb/dbx-components/compare/v13.12.3-dev...v13.12.4) (2026-05-28)


### Bug Fixes

- **firebase-eslint:** inline util/eslint into bundle ([c650f010](https://github.com/dereekb/dbx-components/commit/c650f0105a7894dd0f1248dd2e9742c9ea3ab92f))
- **setup:** atomic write for generated api package.json ([0b4c70d3](https://github.com/dereekb/dbx-components/commit/0b4c70d3a8ef512749c6fe8a7d6b84ff9f4b6601))


### Build System

- lint fix + mcp regeneration + firestore indexes ([64acdfe1](https://github.com/dereekb/dbx-components/commit/64acdfe133c0d8fddd7bfd8216b1f069d788436c))


### Code Refactoring

- added 'none' public PKCE OIDC auth method ([1291044d](https://github.com/dereekb/dbx-components/commit/1291044db8ae8422efe2c2a5458d9404c1e06f64))
- **dbx-cli:** widen CliApiVerb to include 'invoke' ([b6dfbc2c](https://github.com/dereekb/dbx-components/commit/b6dfbc2c4498d1deac38bdbad91d098ee9e36ec9))
- **firebase-server:** password-reset surface overhaul ([3532b1f9](https://github.com/dereekb/dbx-components/commit/3532b1f9ecae528fa57b360b2cc8502f3a44528a))
- **oidc:** add JSON renderError default and MCP resource helper ([63dad472](https://github.com/dereekb/dbx-components/commit/63dad472c8558e26ef5cee5e51b1115daa9db513))
- renamed DEFAULT_MCP_ANALYTICS_EVENT_NAME ([16d267f9](https://github.com/dereekb/dbx-components/commit/16d267f966fe2799b851acd4d43ad0053a7fd348))
- **setup:** align eslint config template with workspace ([a539e34d](https://github.com/dereekb/dbx-components/commit/a539e34d3558f573e8bbabe5f3f420ce5fa0b804))


### Tests

- **demo-api:** align model-info MCP spec with groups-default ([69813bc9](https://github.com/dereekb/dbx-components/commit/69813bc972f6c4cfe08fc357f9e3d0c074322c50))

## [13.12.3](https://github.com/dereekb/dbx-components/compare/v13.12.2-dev...v13.12.3) (2026-05-27)


### Code Refactoring

- **mcp:** expand model-info tool modes ([35fdd957](https://github.com/dereekb/dbx-components/commit/35fdd957a2f42ef7ced3118182a5b79f64a6ae87))
- **model:** tag arktype validators for mcp util lookup ([ed924350](https://github.com/dereekb/dbx-components/commit/ed924350de6e0281108b3651383632e53a6456fc))
- oidc env variable fixes ([a2128fe2](https://github.com/dereekb/dbx-components/commit/a2128fe223f638c686b5521408ed98ce5f0c0b2a))
- update-peer-deps ([8c1c60e7](https://github.com/dereekb/dbx-components/commit/8c1c60e734bb2b2c99372f4c08674e588ea6ebb4))

## [13.12.2](https://github.com/dereekb/dbx-components/compare/v13.12.1-dev...v13.12.2) (2026-05-27)


### Bug Fixes

- **firebase-eslint:** layout-agnostic service-factory discovery ([8c8989fb](https://github.com/dereekb/dbx-components/commit/8c8989fbf84e76686648c1b4932ff86c9571c6d9))
- **firebase-eslint:** resolve framework identities downstream ([fb8be541](https://github.com/dereekb/dbx-components/commit/fb8be541f6ee8f244c7fa141dcd89735cfb11fd2))
- **util-eslint:** ignore @-lines in fenced @example blocks ([585e8f4c](https://github.com/dereekb/dbx-components/commit/585e8f4c570beee2133ec7b88aeca2b70c86acef))


### Build System

- lint fix + mcp regeneration + firestore indexes ([3732ad63](https://github.com/dereekb/dbx-components/commit/3732ad63535d48769095c9dec430e53423418dbb))
- regenerate dbx-cli mcp utils json for path rename ([f8a8802b](https://github.com/dereekb/dbx-components/commit/f8a8802bc94cb8eb55d2ba9e704506cf8c948357))


### Code Refactoring

- added arktype string/number validation constants ([5e91e47b](https://github.com/dereekb/dbx-components/commit/5e91e47bc8ef6ecaae87f3a2732175c42fdeae3d))
- **firebase-server-mcp:** add global MCP analytics service ([67d892ce](https://github.com/dereekb/dbx-components/commit/67d892cef82c498126713c8abd27a22dca81f393))
- fixed require-storagefile-policy-matches-rules ([072702bd](https://github.com/dereekb/dbx-components/commit/072702bdbefbfa9732777f4da7f5238dfe4dc2af))

## [13.12.1](https://github.com/dereekb/dbx-components/compare/v13.12.0-dev...v13.12.1) (2026-05-27)


### Bug Fixes

- **dbx-cli:** discover lint-cache projects under any top-level dir ([89528e28](https://github.com/dereekb/dbx-components/commit/89528e28664afcdd80f560867a2997c66b22dd30))
- **dbx-cli:** resolve downstream role consts in auth extractor ([d269b5ca](https://github.com/dereekb/dbx-components/commit/d269b5caf1b897032f47a0074cf6cd5a60888166))
- **firebase:** bundle cel-js into eslint plugin ([a18452d9](https://github.com/dereekb/dbx-components/commit/a18452d974c6eb6deca45e2861a2740f63724ce6))
- ship missing mcp packaging artifacts ([461a6ff2](https://github.com/dereekb/dbx-components/commit/461a6ff2bdbd6c01a983d2c9469af9fddc8e8514))
- **util-eslint:** deprecated-alias rule only moves true aliases ([f82b1c5f](https://github.com/dereekb/dbx-components/commit/f82b1c5f92d273d3e5a9ba1ecf029db74a5a3fd3))


### Build System

- **firebase:** invalidate build cache on nested eslint changes ([2c75d492](https://github.com/dereekb/dbx-components/commit/2c75d4923a05766d5c75c38468960d0f2c809822))
- lint fix + mcp regeneration + firestore indexes ([84086910](https://github.com/dereekb/dbx-components/commit/840869105f90a356e1eee58494507edefdda2395))


### Code Refactoring

- **firebase-eslint:** autofix api-details + require inputType rule ([cb6cc48b](https://github.com/dereekb/dbx-components/commit/cb6cc48be5421198cc79ee9cfcb002361092006d))

# [13.12.0](https://github.com/dereekb/dbx-components/compare/v13.11.18-dev...v13.12.0) (2026-05-26)


### ai

- add block-pnpm pretooluse bash hook ([1daa7325](https://github.com/dereekb/dbx-components/commit/1daa7325bd2ca03da0b0e91540b3a798a08193eb))


### Bug Fixes

- **firebase-server-mcp:** make model-info outputSchema a root object ([050d7e69](https://github.com/dereekb/dbx-components/commit/050d7e69b7c49105bae3e4d75d4d9b8906c8f976))
- persist guestbook cby and grant creator read/publish ([4a1b761c](https://github.com/dereekb/dbx-components/commit/4a1b761c19d3662ddf75dc8d1d070c9fc3abef88))


### Code Refactoring

- add @dbxModelRead/@dbxModelServiceFactory + lint follow-ups ([4e9d34a5](https://github.com/dereekb/dbx-components/commit/4e9d34a52c4323fb1f8e63046c82a34084129536))
- add allPublishedEntries invoke + MCP guestbook tests ([f224132a](https://github.com/dereekb/dbx-components/commit/f224132a4ab925c4aa2fe2d72d230da5e6112654))
- add invoke call type and firebase-server/mcp package ([595b998a](https://github.com/dereekb/dbx-components/commit/595b998ae039785d9fedcfdc774c8ac29cf62289))
- added banner example ([a2c2d18d](https://github.com/dereekb/dbx-components/commit/a2c2d18d7e99eab9e3ca40400a452264186cbb80))
- build-all change ([a637da9e](https://github.com/dereekb/dbx-components/commit/a637da9e8231540d9e26c7c3bfb6c59f9f75b4af))
- **dbx-cli:** add generate-mcp-manifest build tool ([dab88b3b](https://github.com/dereekb/dbx-components/commit/dab88b3b0abe4279641266e2899b990f4edd2d04))
- **dbx-cli:** relocate MCP scan infrastructure ([add7bfc7](https://github.com/dereekb/dbx-components/commit/add7bfc7181f49e140110c792da4ccd4d1975f92))
- **dbx-components-mcp:** add dbx_log_search tool ([33ca3e0c](https://github.com/dereekb/dbx-components/commit/33ca3e0c547fcd91e6e31c2ed2612bce9512b72b))
- **dbx-components-mcp:** add dbx_route_resolve_url tool ([2f119b66](https://github.com/dereekb/dbx-components/commit/2f119b66ffadc9c3fd649920283e58c2ccaa5035))
- **dbx-components-mcp:** add logs config block ([d1455c0f](https://github.com/dereekb/dbx-components/commit/d1455c0f63d969b357b6d8864a0dc8de11b9d15f))
- **dbx-components-mcp:** cache generate-* targets ([f6b501f9](https://github.com/dereekb/dbx-components/commit/f6b501f94486022684417f7e737df568cfd5e2a9))
- **dbx-web:** add DbxPdfMergeEditorConfig ([eaca23a2](https://github.com/dereekb/dbx-components/commit/eaca23a242612d019eb01341978e7fec1f967f45))
- dedupe dbx-components-mcp extractors and search tools ([50ce4e8e](https://github.com/dereekb/dbx-components/commit/50ce4e8e006a672eba3ef903a650f4fef91b5774))
- dedupe firebase-eslint helpers via @dereekb/util/eslint ([74c34ce5](https://github.com/dereekb/dbx-components/commit/74c34ce5fce6cf00056642ac156b4fc09ad22007))
- **demo-api:** add storageFile generateSignedUploadUrl ([b8ea7eff](https://github.com/dereekb/dbx-components/commit/b8ea7effb3f8529b26e729523b98951e2898c626))
- **demo-api:** route demo-mcp direct to Functions emulator ([734488ac](https://github.com/dereekb/dbx-components/commit/734488ac4d072c7d628613cc7998b3a94386a4c5))
- **demo-api:** wire MCP manifest pipeline + visibility examples ([4f05b76e](https://github.com/dereekb/dbx-components/commit/4f05b76e4197d7d60eea6ad55caedf706283c358))
- **demo-api:** wrap CRUD handlers in withApiDetails ([e8afc076](https://github.com/dereekb/dbx-components/commit/e8afc0769c7fbd271b4aa7dbc05a5146ba52c38e))
- **demo:** added one-way guestbook publish crud function ([0f2ac859](https://github.com/dereekb/dbx-components/commit/0f2ac85915ae0bc18b4f4a5a80d140b59dddd6c4))
- **firebase-eslint:** add service-model firestore lint rule ([1f2d06e7](https://github.com/dereekb/dbx-components/commit/1f2d06e79210a42665ab9a370eb900982eb42f15))
- **firebase-eslint:** add storagefile policy lint rule ([44d3bc92](https://github.com/dereekb/dbx-components/commit/44d3bc92568ca374f212a4832faec883392eda9d))
- **firebase-eslint:** move require-dbx-model-companion-tags rule ([aac60f7c](https://github.com/dereekb/dbx-components/commit/aac60f7c3356fd809f4a528eb48749db93263c09))
- **firebase-eslint:** warn on missing withApiDetails wrappers ([ec16a5fa](https://github.com/dereekb/dbx-components/commit/ec16a5faae5a0f737422d150e4ccfefcd5ec2b85))
- **firebase-server-mcp:** add built-in model-get tool ([aca33cae](https://github.com/dereekb/dbx-components/commit/aca33caecd2e43736d447b33da6953548cb5c2ef))
- **firebase-server-mcp:** add model-info and model-decode tools ([fa1cf542](https://github.com/dereekb/dbx-components/commit/fa1cf54277409eac43472da09f5849f8a480f735))
- **firebase-server-mcp:** add visibility + filter metadata ([ceba46ba](https://github.com/dereekb/dbx-components/commit/ceba46ba34738ea315fc74972f90c9819b7f3db6))
- **firebase-server-mcp:** consume build-time MCP manifest at boot ([2120d2fa](https://github.com/dereekb/dbx-components/commit/2120d2fad661123dcc58854fa4a92a24d50cc8b1))
- **firebase-server-mcp:** filter tools/list per request ([49826db8](https://github.com/dereekb/dbx-components/commit/49826db81ed2e3184c70cb143bc6fa4883939ba3))
- **firebase-server-model:** extend compress-pdf result context ([50992665](https://github.com/dereekb/dbx-components/commit/509926658a1826774d4412de2d588fbab20a5ee8))
- **firebase-server/oidc:** wire MCP resource indicators end-to-end ([232909a2](https://github.com/dereekb/dbx-components/commit/232909a27f396931e5841ee5a82d494892dfc55e))
- **firebase-server:** drop mcp.description handler override ([4d245447](https://github.com/dereekb/dbx-components/commit/4d245447ee784fe01db75050f32dfad4e22ee55c))
- harden password reset against enumeration ([1c9feecc](https://github.com/dereekb/dbx-components/commit/1c9feecc61af2246b11eff4c83386c684809e9d0))
- improve mcp tool schemas and error/void responses ([4fe22817](https://github.com/dereekb/dbx-components/commit/4fe2281721a6e0a6a1d25a1f3a8e8fb9a2370e55))
- lift image compression to dbx-web, add upload modifier ([0d4decf1](https://github.com/dereekb/dbx-components/commit/0d4decf109d0650aa5a477b636874bb44b8ec1a0))
- lint cleanup + firebase-eslint dist resolution ([f8cd556b](https://github.com/dereekb/dbx-components/commit/f8cd556bd8cfcf334d25e5ca1e9177b8ed894359)), closes [Array#push](https://github.com/dereekb/Array/issues/push)
- lint-fix ([be9e5ad5](https://github.com/dereekb/dbx-components/commit/be9e5ad5d6755db9a2eb21437de446cf56d02440))
- non-admin can paginate published guestbooks ([a360b47f](https://github.com/dereekb/dbx-components/commit/a360b47f3728e2035716aca5a725607283ea98d2))
- reduce cognitive complexity in dbx-model factory rule ([ad2a69ad](https://github.com/dereekb/dbx-components/commit/ad2a69adc56e23dd4add743c57c6af31e7ffbb17))
- require-constant-naming fixes ([5573d652](https://github.com/dereekb/dbx-components/commit/5573d652b9c6203be2cb5c0d984e18074cf71713))
- resolve sonar issues from 2026-05-24 scan ([35dc355e](https://github.com/dereekb/dbx-components/commit/35dc355e4042da521a4992a04c70dcc083e500d6))
- resolve sonar issues from 2026-05-25 scan ([80f6ace7](https://github.com/dereekb/dbx-components/commit/80f6ace79bdd836c9e59c36949cd6bd1a100be34)), closes [Array#push](https://github.com/dereekb/Array/issues/push)
- resolve sonar issues from 2026-05-25 scan (batch 2) ([e58d5b0c](https://github.com/dereekb/dbx-components/commit/e58d5b0cc26011102ac4c19ddaafe22f62e9ab49))
- resolve sonar issues from 2026-05-25 scan (batch 3) ([ac3cf9f3](https://github.com/dereekb/dbx-components/commit/ac3cf9f350695dad87ddd6afce2b3675d5db48f4))
- resolve sonar issues from 2026-05-26 scan ([efc1ef1c](https://github.com/dereekb/dbx-components/commit/efc1ef1c1cfdd07bf12ea94db812eb4d672c4a14))
- resolve sonar issues from 2026-05-26 scan (batch 2) ([9f9824fa](https://github.com/dereekb/dbx-components/commit/9f9824fa6a6181804f6f16a543fbd533c820b9b9))
- resolved lint warnings across workspace ([29746f8a](https://github.com/dereekb/dbx-components/commit/29746f8a4c4986462d50c1587c208e090887edc2))
- resolved new sonarqube issues ([a69de9ed](https://github.com/dereekb/dbx-components/commit/a69de9ed3aaf053304a8ae9cfee27b87ece372d5))
- rework storagefile signed-upload-url and policy wiring ([d784e368](https://github.com/dereekb/dbx-components/commit/d784e368b87a6e132742c42b6d8aca19c53dab5d))
- surface @dbxModelRead posture in model output ([5cd7a949](https://github.com/dereekb/dbx-components/commit/5cd7a949369c0b564d285ad909a8cdfb192fc125))
- **trello:** add listBoardActions ([8eeee3aa](https://github.com/dereekb/dbx-components/commit/8eeee3aaf85dccf6a8608696b38a616ff7debcc7))
- **twilio:** add nestjs/twilio and firebase-server/twilio ([137c8389](https://github.com/dereekb/dbx-components/commit/137c838914c886db2521e34b6828c5b20a4a2b30))
- update ng-forge to v0.9.0 ([5b083419](https://github.com/dereekb/dbx-components/commit/5b083419660e803d4885606058d4a3089cf07968))
- update ng-forge to v0.9.0-next.13 ([427980d2](https://github.com/dereekb/dbx-components/commit/427980d24875bac5458b42d3b220ca2ce0a15327))
- wire image compression into storagefile uploads ([1f3b8dce](https://github.com/dereekb/dbx-components/commit/1f3b8dce97f294ced5ad288422b595e3cbbdd348))


### Continuous Integration

- stabilize nx cache across jobs ([f3b7a1f2](https://github.com/dereekb/dbx-components/commit/f3b7a1f212a046e728a66a54c21f6cc41091bea9))


### Features

- **firebase-server-mcp:** add whoami tool with persisted auth manifest ([0779182b](https://github.com/dereekb/dbx-components/commit/0779182bf3cc94f6890d28d2d84e875bcfb46b4c))


### Tests

- **demo-api:** add resetPassword crud test ([0073b002](https://github.com/dereekb/dbx-components/commit/0073b0027f62afbe02eff76475f4e91d250fbf03))
- **nestjs-discord:** gate integration suite and share login ([2196832b](https://github.com/dereekb/dbx-components/commit/2196832b58e26863f4a24bedae4140de597e1e4c))

## [13.11.18](https://github.com/dereekb/dbx-components/compare/v13.11.17-dev...v13.11.18) (2026-05-21)


### Bug Fixes

- **dbx-form-calendar:** orphan-field on partial source emissions ([5c5b1c4e](https://github.com/dereekb/dbx-components/commit/5c5b1c4ee197a2bab8968ce84e66cf19930c3abf))


### Build System

- lint fix + mcp regeneration + firestore indexes ([777e366f](https://github.com/dereekb/dbx-components/commit/777e366ff31230a0bdc2b863b2e0e78ce435d28c))


### Code Refactoring

- added require-complete-crud-function-config-map lint rule ([ac023eb0](https://github.com/dereekb/dbx-components/commit/ac023eb07a62b8bf2910ebdb2f0a68bdfa45ecad))
- bump dynamic-forms to 0.9.0-next.12 ([b78a3418](https://github.com/dereekb/dbx-components/commit/b78a341827be106a2eb0e05af25aea03590e4782))
- **dbx-web:** tagged content utilities for mcp ([863b25a7](https://github.com/dereekb/dbx-components/commit/863b25a7014df05b7565a7348622868ef151e553))
- **firebase-eslint:** require type param on where/orderBy ([f0f53609](https://github.com/dereekb/dbx-components/commit/f0f53609858bc039a4290ed92bca842dcffd901b))


### Continuous Integration

- add dbx-cli tests to test-with-node-basic ([eb3a6bb0](https://github.com/dereekb/dbx-components/commit/eb3a6bb00723bff93cfaa1066d17f29f263804ff))

## [13.11.17](https://github.com/dereekb/dbx-components/compare/v13.11.16-dev...v13.11.17) (2026-05-19)


### Build System

- lint fix + mcp regeneration + firestore indexes ([4959fb1d](https://github.com/dereekb/dbx-components/commit/4959fb1d22478c1b7ad914f0be5c18546ce2ca0e))


### Code Refactoring

- bumped ng-forge to 0.9.0-next.11 ([3ff5cf36](https://github.com/dereekb/dbx-components/commit/3ff5cf36af96b09a20164ec4eba38dd9a2095601))
- **dbx-components-mcp:** add dbx_model_test_list_app tool ([d9db3a2d](https://github.com/dereekb/dbx-components/commit/d9db3a2d3b87ee2100f415c37e8581ad9f492444))
- **dbx-components-mcp:** add model-test convention + validator ([8d69b57e](https://github.com/dereekb/dbx-components/commit/8d69b57e3b63a989910f6d8d34a4ae489c4a8222))
- **dbx-web:** register .dbx-link, add .dbx-link-hover ([bc5e8f0c](https://github.com/dereekb/dbx-components/commit/bc5e8f0c3bc5f9d073c3376cc6f56552e91bf00a))
- **trello:** added card attachment crud + download ([83bd5749](https://github.com/dereekb/dbx-components/commit/83bd574904a362ae76beeaf3a7d5b57ba7db34f5))

## [13.11.16](https://github.com/dereekb/dbx-components/compare/v13.11.15-dev...v13.11.16) (2026-05-19)


### Bug Fixes

- **dbx-components-mcp:** credit dispatcher refs to delegates ([da532030](https://github.com/dereekb/dbx-components/commit/da5320307670b98d5f88b1a7e81059c28c60db10))


### Build System

- **release:** regenerate firestore.indexes.json in start-release ([1b8dbc60](https://github.com/dereekb/dbx-components/commit/1b8dbc601d9a8e5ae44f5f3df45152dc5f71d30d))


### Code Refactoring

- **dbx-cli:** relocate firestore-indexes from dbx-components-mcp ([20e97a4a](https://github.com/dereekb/dbx-components/commit/20e97a4a18372b247083c40364e73c55b256b661))
- **demo-firebase:** declare guestbook query verb + scan config ([edecf123](https://github.com/dereekb/dbx-components/commit/edecf1233d9a505ae87239dae4c3f0c499bf6d5d))
- **eslint:** add @dereekb/firebase/eslint with 4 index rules ([f10f506c](https://github.com/dereekb/dbx-components/commit/f10f506c0dbea1196316ffa1b81f4cda7d275439))
- export eslint plugins camel case ([ee343614](https://github.com/dereekb/dbx-components/commit/ee3436148809343df373490204fd2a955d781fcd))
- **firebase-eslint:** rename dispatcher rule ([cbbe755a](https://github.com/dereekb/dbx-components/commit/cbbe755a4f7b56ef78621c752bc0b7430efa196d))


### Documentation

- **dbx-web:** tag style/color services and directives for UI catalog ([15143815](https://github.com/dereekb/dbx-components/commit/1514381545f1d2b462c01354a9c2aad21a049791))
- expanded DateCellScheduleEncodedWeek jsdocs ([0b46f709](https://github.com/dereekb/dbx-components/commit/0b46f709a4ac28a7eac535cc993b87ea64325b44))

## [13.11.15](https://github.com/dereekb/dbx-components/compare/v13.11.14-dev...v13.11.15) (2026-05-18)


### Code Refactoring

- eslint v10 ([#51](https://github.com/dereekb/dbx-components/issues/51)) ([b65b1ad8](https://github.com/dereekb/dbx-components/commit/b65b1ad8b5054bda2b1ba0b787f56b7b788ceb12)), closes [#51](https://github.com/dereekb/dbx-components/issues/51) [String#match](https://github.com/dereekb/String/issues/match) [Array#push](https://github.com/dereekb/Array/issues/push)
- lint-fix ([cca88a22](https://github.com/dereekb/dbx-components/commit/cca88a22924fc52d6c58b2a6919cbff0de998608))

## [13.11.14](https://github.com/dereekb/dbx-components/compare/v13.11.13-dev...v13.11.14) (2026-05-17)


### Build System

- **trello:** wire publishing in workspace and circleci ([f9dfb1fc](https://github.com/dereekb/dbx-components/commit/f9dfb1fc822459f1b33cc541ac8d7788de566efd))


### Code Refactoring

- added trello api tests ([f166ed80](https://github.com/dereekb/dbx-components/commit/f166ed80c15cce7da95ed2011f66e01c5589c4f6))
- **trello:** add @dereekb/trello package ([94e3a9db](https://github.com/dereekb/dbx-components/commit/94e3a9db4cda82997c0c446b996b1679b0587fed))
- **trello:** add card actions, board labels, checklists ([bbd4f3f7](https://github.com/dereekb/dbx-components/commit/bbd4f3f7d2ea774e42955636d56e338cc51290ce))

## [13.11.13](https://github.com/dereekb/dbx-components/compare/v13.11.12-dev...v13.11.13) (2026-05-16)


### Bug Fixes

- **dbx-web:** ship eslint/package.json in npm tarball ([86a31aed](https://github.com/dereekb/dbx-components/commit/86a31aed1a756e3a74191acb8bd195e6af70425a))


### Build System

- lint fix + mcp regeneration ([dedf4b41](https://github.com/dereekb/dbx-components/commit/dedf4b4183b29af0cc3fb4fe644c43c4f4be4745))


### Code Refactoring

- added vitest retry config ([567e895d](https://github.com/dereekb/dbx-components/commit/567e895d3cfd83207cc1c2a45dff288ac7cbb479))
- **dbx-components-mcp:** add model archetype tool cluster ([2a7de7a8](https://github.com/dereekb/dbx-components/commit/2a7de7a8fa468874e47070d54e311837794d45d9))
- **dbx-components-mcp:** composite-key-root archetype + tag ([197810ef](https://github.com/dereekb/dbx-components/commit/197810ef3e11380356ef179aea82dcecd521a6a7))
- **dbx-components-mcp:** enforce branch-free query bodies ([dd5f4571](https://github.com/dereekb/dbx-components/commit/dd5f457189c437162173454f6386cb6bae387db9))
- **dbx-components-mcp:** refine archetype tool cluster ([1e121355](https://github.com/dereekb/dbx-components/commit/1e1213550a63a4cb6e4b2eeac00ec7eba7adf323))
- **dbx-components-mcp:** resolve sonarqube findings ([6053b81d](https://github.com/dereekb/dbx-components/commit/6053b81d609a8963500963ece6c3a4e2069bb734))
- **dbx-components-mcp:** wire firebase-index rule catalog ([1e501487](https://github.com/dereekb/dbx-components/commit/1e501487901a2536da2ed5902298d9d5d835586a))
- **dbx-form:** silence forge.registry bare-import warning ([976b7f68](https://github.com/dereekb/dbx-components/commit/976b7f6810f71ad2ad6d910fc8bb4e0394bf4821))
- **dbx-form:** updated ng-forge ([db2544e9](https://github.com/dereekb/dbx-components/commit/db2544e95d44e6ba7e90a858babb4b7930352710))
- **firebase:** typed return tuples for constraint helpers ([fb59382a](https://github.com/dereekb/dbx-components/commit/fb59382a3c22e843163391d59763692191416dbc))
- **util:** added HourOfDay semantic type and isHourOfDay ([e9eb0c91](https://github.com/dereekb/dbx-components/commit/e9eb0c91e83f9b9cc995f24f9283db2cdb24f2c0))

## [13.11.12](https://github.com/dereekb/dbx-components/compare/v13.11.11-dev...v13.11.12) (2026-05-15)


### Code Refactoring

- add image and pdf compression utilities ([c57ee824](https://github.com/dereekb/dbx-components/commit/c57ee824ac75d43827712e0d99a88561c94b02a1))
- **dbx-cli:** handler helpers, env resolve, http tracing ([73284223](https://github.com/dereekb/dbx-components/commit/73284223963456f8eec6c721970d3296a0b52a83))
- **dbx-cli:** wire test subpackage build ([b5e8fd03](https://github.com/dereekb/dbx-components/commit/b5e8fd03952f1ea4ef71b6891beda9b275db1bff))
- **dbx-components-mcp:** expand css-utility role vocab ([3654f118](https://github.com/dereekb/dbx-components/commit/3654f11871f6c05296db873d9e21e2134880aca4))
- **dbx-components-mcp:** rule catalog, search tools, list mode ([bf8d74c7](https://github.com/dereekb/dbx-components/commit/bf8d74c7e346dad8376368e73d7c482093bafe5b))
- **dbx-components-mcp:** wire remaining scan-* bin subcommands ([d81a6f0a](https://github.com/dereekb/dbx-components/commit/d81a6f0ab231e32ecbb032a69328477746eae8cf))
- **util:** fast-path splitJoinRemainder for limit 1 and 2 ([cacccd3d](https://github.com/dereekb/dbx-components/commit/cacccd3d9c49f152f7fa16bd4774def97f1f35bb))

## [13.11.11](https://github.com/dereekb/dbx-components/compare/v13.11.10-dev...v13.11.11) (2026-05-15)


### Bug Fixes

- **dbx-components-mcp:** formatExtractWarning exhaustiveness ([f4d20613](https://github.com/dereekb/dbx-components/commit/f4d20613c5efc5ee26a2b84d4a75ed1076cde38e))


### Build System

- lint fix + mcp regeneration ([f14d2cac](https://github.com/dereekb/dbx-components/commit/f14d2cacecf4c6fccea001bae4c88906f688aaee))


### Code Refactoring

- added guestbook.actions.spec.ts ([f9e02c30](https://github.com/dereekb/dbx-components/commit/f9e02c30053ce9e4100b732276b3356ef9693ff9))
- **dbx-cli:** add ActionCommandSpec + callModel iterator ([14d3c1f9](https://github.com/dereekb/dbx-components/commit/14d3c1f9aeff78fdf2f0183bfd4102a3aadd11b3))
- **dbx-cli:** resolve sonarqube findings ([ff1c2e95](https://github.com/dereekb/dbx-components/commit/ff1c2e95c81e8e0c81d582cc0dd4a08bb0c258fa))
- **dbx-components-mcp:** add color template tools ([ad5b1d18](https://github.com/dereekb/dbx-components/commit/ad5b1d182cb34db5d2c7154c010cad0cf5431bad))
- **dbx-components-mcp:** add model-firebase-index cluster ([9897e006](https://github.com/dereekb/dbx-components/commit/9897e006c2ea27c9d0205673dbc3f7055ac964c5))
- **dbx-components-mcp:** reduce cognitive complexity ([3a323bc6](https://github.com/dereekb/dbx-components/commit/3a323bc633652684b5fc07cdb41db5d1983b4e8a))
- **dbx-components-mcp:** resolve sonarqube findings ([cfd3cbf8](https://github.com/dereekb/dbx-components/commit/cfd3cbf8612294fac6c2f7ad25fe46e2973caaa8))
- **dbx-web:** add DbxColorService with color templates ([ee0f593e](https://github.com/dereekb/dbx-components/commit/ee0f593efa4ccb161794675ba23bce71978df7ac))
- **firebase:** land query crud function support ([8801159c](https://github.com/dereekb/dbx-components/commit/8801159c6f18b359acc4458c82e8102a065d55a7))
- **mcp:** add manifest identity duplicate validator ([b066a590](https://github.com/dereekb/dbx-components/commit/b066a59067cd18deb362638d749ec49743eb3534))
- resolve sonarqube findings ([1ddc1191](https://github.com/dereekb/dbx-components/commit/1ddc119159e6d2bb5ea3a9fd42f4ff3a45df3d66))
- resolve sonarqube findings ([700c8d43](https://github.com/dereekb/dbx-components/commit/700c8d4373ec135f1d92c432c4b45de90cc887f2))
- updated build target to es2023 ([00c30887](https://github.com/dereekb/dbx-components/commit/00c30887ea53aae653b86965b1b246633873f8a5))


### Tests

- **dbx-cli:** added vitest CLI integration test scaffolding ([71bfdb98](https://github.com/dereekb/dbx-components/commit/71bfdb98be2f5a16a1f3b217d9d932fe9b8b1a9b))

## [13.11.10](https://github.com/dereekb/dbx-components/compare/v13.11.9-dev...v13.11.10) (2026-05-12)


### Bug Fixes

- **oidc:** prevent duplicate OAuth login submissions ([19cc0375](https://github.com/dereekb/dbx-components/commit/19cc0375b66c76ac41453c984175a43ea3173b33))


### Build System

- lint fix + mcp regeneration ([a979a212](https://github.com/dereekb/dbx-components/commit/a979a212cedf616497d6af9b8e68b8c1b467ecac))


### Code Refactoring

- **dbx-cli:** per-model get accepts bare id for root models ([c6f83ed9](https://github.com/dereekb/dbx-components/commit/c6f83ed9a14b5105ec5cbdbed1f52921ba7d2d56))
- **util:** added claimKeys and copyClaims to claims service ([2e909720](https://github.com/dereekb/dbx-components/commit/2e909720b92c95c4d2fdfe2c14cb2d4cda6b24c6))

## [13.11.9](https://github.com/dereekb/dbx-components/compare/v13.11.8-dev...v13.11.9) (2026-05-11)


### Bug Fixes

- **firebase-server:** preserve JWT claims on OIDC model reads ([4872c20f](https://github.com/dereekb/dbx-components/commit/4872c20f594d92f2c1fe2e78a2607786bd858ac9))
- **oidc:** tolerate already-granted scopes on re-consent ([7d2344d8](https://github.com/dereekb/dbx-components/commit/7d2344d84daa7a1afca4c01de64f6e70233f3910))

## [13.11.8](https://github.com/dereekb/dbx-components/compare/v13.11.7-dev...v13.11.8) (2026-05-11)


### Bug Fixes

- **dbx-cli:** drop broken /oidc/login/client shortcut ([f32a3cd8](https://github.com/dereekb/dbx-components/commit/f32a3cd8048f720d962e2f983f78b9afd142a7f6))


### Code Refactoring

- **dbx-cli:** expose model get routes via CLI ([8837d030](https://github.com/dereekb/dbx-components/commit/8837d03097c76cd4f23d93a1c9a9fccea20b0ec6))
- **dbx-cli:** use oidcIssuer for /login/client shortcut ([87ec076e](https://github.com/dereekb/dbx-components/commit/87ec076ecaa01dbee6823c72c84298998bf0d963))
- **dbx-components-mcp:** subobject validation + catalog ([e9c8d634](https://github.com/dereekb/dbx-components/commit/e9c8d634f1760bbc0974e2be849b78886f188d92))
- model-decode tool for firestore keys ([eba537eb](https://github.com/dereekb/dbx-components/commit/eba537ebebb408fc3a54c0d3191d67af00dcc216))
- **oidc:** add standard OIDC scope constants ([89f57232](https://github.com/dereekb/dbx-components/commit/89f57232812d0d02e71e631bb554c362bd3a7ecf))
- **oidc:** updated oidc discovery ([eeb3a214](https://github.com/dereekb/dbx-components/commit/eeb3a214f70d03d2cd4f7e18af48c1962453b9c3))

## [13.11.7](https://github.com/dereekb/dbx-components/compare/v13.11.6-dev...v13.11.7) (2026-05-11)


### Build System

- lint fix + mcp regeneration ([6b340b3e](https://github.com/dereekb/dbx-components/commit/6b340b3e43b18ffacebdd9c4bf9a443a44196d3d))


### Code Refactoring

- added @dbxModelSubObject validator tag ([36e7309f](https://github.com/dereekb/dbx-components/commit/36e7309fe6c00c3b24b94e8af27e519e2a24f4ed))
- added DEFAULT_CLI_REDIRECT_URL ([8099d536](https://github.com/dereekb/dbx-components/commit/8099d5368d8d2e086c2ec68badf52d30d1ea41fc))
- added oidcApiOrigin to OIDC config ([687ffaa8](https://github.com/dereekb/dbx-components/commit/687ffaa8a3dd6feba4d048ea3d4e2f7b59a5b3a3))
- dbx-components-mcp firestore sub model validation ([05035a63](https://github.com/dereekb/dbx-components/commit/05035a63b426bca6c104dae232eeca69192cf37c))
- deprecated customButtonColor on dbx-button ([9caef732](https://github.com/dereekb/dbx-components/commit/9caef732b31b5777bf8d6a5a1a6278439e1904b4))
- notification factory mcp validation fix ([116871bb](https://github.com/dereekb/dbx-components/commit/116871bb83a78d6938fbcc15bc2176fe674d2233))
- updated oidc issue ([478e08be](https://github.com/dereekb/dbx-components/commit/478e08becb633f75f43bb7790d0cf8af63c37aca))

## [13.11.6](https://github.com/dereekb/dbx-components/compare/v13.11.5-dev...v13.11.6) (2026-05-10)


### Bug Fixes

- peel utility wrappers in interface extends walk ([ab472e9c](https://github.com/dereekb/dbx-components/commit/ab472e9cd8f01b12465ed25e730c9f661ef16c0e))


### Build System

- lint fix + mcp regeneration ([b2a372f3](https://github.com/dereekb/dbx-components/commit/b2a372f34c964e97f53dc69588fdc77b09772521))


### Code Refactoring

- added preview to DbxAppEnvironment ([5761ddc7](https://github.com/dereekb/dbx-components/commit/5761ddc733d36706f6eddd031381020923ca6db4))
- dbx-button height utilities + new docs examples ([63c69b86](https://github.com/dereekb/dbx-components/commit/63c69b8638e613722cba22a8202f41f41d1e14f4))
- opt-in converter emission in model manifest ([98d15a3b](https://github.com/dereekb/dbx-components/commit/98d15a3b1fbed4410a46bd6cdae7e24f16db595a))
- warn on @dbxModelVariable matching field name ([e8343cad](https://github.com/dereekb/dbx-components/commit/e8343cad72fb57f83e0916c4bccbed949359d716))
- widen color pass-through inputs to DbxColorInput ([5ce9da02](https://github.com/dereekb/dbx-components/commit/5ce9da02c0c0a1646e2a1768cc7182f5b388f889))

## [13.11.5](https://github.com/dereekb/dbx-components/compare/v13.11.4...v13.11.5) (2026-05-10)


### Code Refactoring

- oidc fixes ([d2f369c1](https://github.com/dereekb/dbx-components/commit/d2f369c1b3fba7303d62195862e54027f4f647b2))
- oidc flow improvement ([10aa4c27](https://github.com/dereekb/dbx-components/commit/10aa4c27e77b1f6bda12e00eeeb58d3ac7cc4033))
- opt-in model-info command and manifest emission ([df34c222](https://github.com/dereekb/dbx-components/commit/df34c22254958e93ced2a039fa8ae1fce0c823c8))
- split dbx-cli-firebase-api-manifest build target ([4689b6c4](https://github.com/dereekb/dbx-components/commit/4689b6c4b6c09c4979ec560e8ec02fafd492b655))


### Tests

- added oidc security regression tests ([b6ca6a3a](https://github.com/dereekb/dbx-components/commit/b6ca6a3a121ae70d0ffa0ced313ddddbebcd793d))

## [13.11.4-dev](https://github.com/dereekb/dbx-components/compare/v13.11.3-dev...v13.11.4-dev) (2026-05-09)


- feat!: dbx-components v13 (#33) ([910d11f5](https://github.com/dereekb/dbx-components/commit/910d11f59a9ea73fc4a7a1e87698cca331f78bec)), closes [#33](https://github.com/dereekb/dbx-components/issues/33)
- Merge pull request #4 from dereekb/dev/release ([88194e0c](https://github.com/dereekb/dbx-components/commit/88194e0ca2b46ff36a910fc30f8761c4b78ca8e4)), closes [#4](https://github.com/dereekb/dbx-components/issues/4)
- Merge pull request #2 from dereekb/dev/setup ([3f3dc8b1](https://github.com/dereekb/dbx-components/commit/3f3dc8b19c5b17be94ee6eb178ab8c972fe8fc89)), closes [#2](https://github.com/dereekb/dbx-components/issues/2)


### ai

- added dbx-merge-release skill ([68fd1941](https://github.com/dereekb/dbx-components/commit/68fd1941c1f4a5d7781a3a48adb4236898a5aba8))
- moved skills to .claude ([ae63e335](https://github.com/dereekb/dbx-components/commit/ae63e335c520a1df5acde6fa330c0a175b66fc2e))
- removed deprecated skills ([c4d231f7](https://github.com/dereekb/dbx-components/commit/c4d231f7f61c435beed6dd8332755db5c2e43d68))


### Bug Fixes

- @nrwl/devkit version fix ([1818b79a](https://github.com/dereekb/dbx-components/commit/1818b79a391036dd740bad6114994d7e8c379491))
- accordion trackId collision across groups ([a17009f8](https://github.com/dereekb/dbx-components/commit/a17009f8c2d2426f7fe16fe99e5efa006ca32d24))
- added asIterable to handle strings ([9d5b7854](https://github.com/dereekb/dbx-components/commit/9d5b7854b6ce4f3c08b4b36fa75419fb97e8d548))
- added daylight savings handling for isValidDateBlockTiming() ([1955016c](https://github.com/dereekb/dbx-components/commit/1955016cb715934d0b86246dbee3b754bb7e9cfd))
- added dbxStyleBody to template root layout ([2897f90b](https://github.com/dereekb/dbx-components/commit/2897f90b869b30c103c4c16a78796a8899f11098))
- added dependencies to setup-project.sh ([30c985d2](https://github.com/dereekb/dbx-components/commit/30c985d222bc5985da9523484833bb2caa635e02))
- added error handling to DbxFirebaseAuthService authUserState ([206132f2](https://github.com/dereekb/dbx-components/commit/206132f2dcc0c40adfd889ad98f70396021f87d1))
- added handleFetchJsonParseErrorFunction config ([71c16810](https://github.com/dereekb/dbx-components/commit/71c16810abd7d490769ae956cfa7e9f2e4d5a514))
- added KeyAsString ([1337d42c](https://github.com/dereekb/dbx-components/commit/1337d42c0877173f55fe07e73958643766912301))
- added missing dest to child ng-package.json files ([7095d4c7](https://github.com/dereekb/dbx-components/commit/7095d4c7caf9379b50f9d38394d59b5c2da8fb9d))
- added pattern to textAreaField() ([de64fa74](https://github.com/dereekb/dbx-components/commit/de64fa74291781bd3044074de252b893a7de60a9))
- added project context to all firebase cli calls ([9b7fd202](https://github.com/dereekb/dbx-components/commit/9b7fd202f12ca303e171657b1d74ec7f4f6c0105))
- added system files to setup ([22515466](https://github.com/dereekb/dbx-components/commit/2251546683f4befefc37f78070eaa362c93c7e24))
- added test-setup.ts config to setup-project.sh ([d374bf54](https://github.com/dereekb/dbx-components/commit/d374bf54af9114a63c9cefee30190376e12555ba))
- adding missing exports ([b2c6b0db](https://github.com/dereekb/dbx-components/commit/b2c6b0db82215a2d0600034f0361d7dc9edffb94))
- analytics fixes ([f21e0d60](https://github.com/dereekb/dbx-components/commit/f21e0d600b0a7d08de6a257fc10645fcd5cc0264))
- appWebhookUrl missing globalApiRoutePrefix ([37a39f7b](https://github.com/dereekb/dbx-components/commit/37a39f7b00ff764cfdcc241b6ba3fcc813096e59))
- arktype narrow null guard for type intersection ([ba3938ee](https://github.com/dereekb/dbx-components/commit/ba3938eeebe55cc595863b2b51299ef8bae3a763))
- assignValuesToPOJOFunction() now uses a copy by default ([e7f446da](https://github.com/dereekb/dbx-components/commit/e7f446da0687b3c9757f7c83f8fe36333403fed2))
- beginResetPassword() now sets the password properly ([7137ed7d](https://github.com/dereekb/dbx-components/commit/7137ed7df48e35fbd9bdb7c920043aa4d634b507))
- bump setup-project components version ([7c704765](https://github.com/dereekb/dbx-components/commit/7c704765692e9cbe21014082f36a52493bd27cd9))
- calendar selection store min/max range with filter fix ([865ef18d](https://github.com/dereekb/dbx-components/commit/865ef18d2456a6be4f040c485196a3d6eef2386b))
- cleanup() now calls the destroy function on complete ([dc8f06b7](https://github.com/dereekb/dbx-components/commit/dc8f06b7a5b9f62973356a967867400abb9049e3))
- dateCellTimingStartPair DST cross-timezone bug ([9d16da29](https://github.com/dereekb/dbx-components/commit/9d16da291dafe02bfd429d8974d250753180de90))
- **date:** fix cross-timezone minMaxDateRange index ([1282aae7](https://github.com/dereekb/dbx-components/commit/1282aae7b02dd0ea6dd2ed38273aa2595c4dfdd4))
- dbx mapbox drawer style fix ([54fa8f21](https://github.com/dereekb/dbx-components/commit/54fa8f21940200ecc1840211ec95e93a7e4c0421))
- **dbx-form:** datetime preset reverts under tz shift ([9b8dfecc](https://github.com/dereekb/dbx-components/commit/9b8dfecc48070b15a7a99a6899a846801c70f0fe))
- **dbx-form:** deduplicate searchable field type defs ([ec3e7a21](https://github.com/dereekb/dbx-components/commit/ec3e7a217520296fb030e07976c03e230a20f480))
- **dbx-form:** extract _formConfig from nested forge fields ([4e5d90e3](https://github.com/dereekb/dbx-components/commit/4e5d90e39ba7db69b7d6dd65512abb4a4dea186a))
- **dbx-form:** forge enforceStep validator on empty number input ([799e388c](https://github.com/dereekb/dbx-components/commit/799e388cb26b0c1ea8df01892f3e770ee18a56c5))
- **dbx-form:** forge form-field wrapper Material CSS leak ([e55ae02c](https://github.com/dereekb/dbx-components/commit/e55ae02c16c601e8f92afdc457b80b87a14b2c9f))
- **dbx-form:** forge stripEmptyValues now recurses into arrays ([1e771eee](https://github.com/dereekb/dbx-components/commit/1e771eee6d52cd853d7555c5147e35e82b51234f))
- **dbx-form:** integrate ng-forge fixes ([34c22fe5](https://github.com/dereekb/dbx-components/commit/34c22fe5f56084ef7ed4971c3ff23298a3246729))
- dbx-mapbox-marker icon content fix ([0b6165f5](https://github.com/dereekb/dbx-components/commit/0b6165f552096498159e4643a1ddc47743ef4b79))
- dbx-section style fixes ([2bdaa888](https://github.com/dereekb/dbx-components/commit/2bdaa888177fcd6cc939b42e552e0445db4a86c3))
- dbx-section-page fixes ([c23a9c40](https://github.com/dereekb/dbx-components/commit/c23a9c40e4935d7ec2b0b64928a0e50f6ceb5f9d))
- dbx-web, dbx-form now export scss in package.json ([c7f7c148](https://github.com/dereekb/dbx-components/commit/c7f7c1485aedfe80243c78435d8b39ece60c3a60))
- dbxDateTimeFieldComponent initial date fix ([1704052a](https://github.com/dereekb/dbx-components/commit/1704052a31822dc880a03aaf52a4488f58305086))
- dbxFormSource reset mode feedback loop ([a8c7b5aa](https://github.com/dereekb/dbx-components/commit/a8c7b5aa6706c01b3a42288c3a165afcf40a83ef))
- dependency fix ([3445223b](https://github.com/dereekb/dbx-components/commit/3445223b048b323d918b07298a2823205af616f6))
- documentAccessorForTransaction/WriteBatch now accepts a Maybe value ([beb17379](https://github.com/dereekb/dbx-components/commit/beb173794ce2cf60b41e43ccfc2b4e4eeda53224))
- drop emulator option from app template root.app.config ([790c990c](https://github.com/dereekb/dbx-components/commit/790c990c9098bddf85fa9e003c2d1c498ebc436a))
- eagerly init firebase services in provideDbxFirebaseApp ([eb95556a](https://github.com/dereekb/dbx-components/commit/eb95556a5a57138c4048373f5b8b5bf386c7de28))
- firebase dependency fix ([0ebd9b94](https://github.com/dereekb/dbx-components/commit/0ebd9b946f5d1accfb25f2e73296c7051331cc8f))
- firebase storage test fix ([ff5c53ab](https://github.com/dereekb/dbx-components/commit/ff5c53ab8a76a8b3ede356f2ba7d00006db3237f))
- firebase-server update fix ([38a52ca5](https://github.com/dereekb/dbx-components/commit/38a52ca5894cded928127848b7a3b2e7283dbf18))
- firebase-tools dependency version bump ([2de00199](https://github.com/dereekb/dbx-components/commit/2de0019986b0d475d3f528f3611b891cbdf757ba))
- firestoreEnum test fix ([5996b79c](https://github.com/dereekb/dbx-components/commit/5996b79c292aaed67137738ac95652dce81060c7))
- firestoreString now has a type specified ([ac7db1f5](https://github.com/dereekb/dbx-components/commit/ac7db1f5d145ce5b98c37e45029db2b06d40d329))
- fix unintentional deprecated variable renaming ([5f28f51e](https://github.com/dereekb/dbx-components/commit/5f28f51ed569a16f277daa779157e4c64554180e))
- fixed AbstractDbxFirebaseDocumentStore key observables ([8f663a28](https://github.com/dereekb/dbx-components/commit/8f663a28e409837c1c36f00ad9a9b6ef805ddd15))
- fixed AbstractDbxPresetFilterMenuComponent usage of getters ([b1540846](https://github.com/dereekb/dbx-components/commit/b154084650df01ee36cc011819e73bbac5d855ba))
- fixed AbstractSingleItemDbxFirebaseDocument constructor ([c2666036](https://github.com/dereekb/dbx-components/commit/c266603697414a661a3f546e2634b3641d47b77e))
- fixed AbstractSingleItemDbxFirebaseDocument setFirestoreCollection ([d0e83522](https://github.com/dereekb/dbx-components/commit/d0e83522e10b1923146c4db6ef241fe2640338ef))
- fixed beginResetPassword() ([fdce1b8d](https://github.com/dereekb/dbx-components/commit/fdce1b8d583f4533f1d4ba4c7c7092c505bf1705))
- fixed beginResetPassword() ([5341f5cc](https://github.com/dereekb/dbx-components/commit/5341f5cc6293cfe6cafdc14d4d4d2eebe9375f6b))
- fixed booleanFactory() chance calculation ([a2443416](https://github.com/dereekb/dbx-components/commit/a24434163e6a9ea9cb9d6764b3026c0eddb978eb))
- fixed calendar schedule filter output value ([c9b6021b](https://github.com/dereekb/dbx-components/commit/c9b6021b797a5298e56a2ad5dbee071d96a19bce))
- fixed calendar selection end being before start when using a filter ([25f905f6](https://github.com/dereekb/dbx-components/commit/25f905f6da092e4b2fbc42fdacd2dfb9d9c7eff1))
- fixed calendar selection regression ([7e6a1373](https://github.com/dereekb/dbx-components/commit/7e6a137329aa597b09c6ea7e49e587fd6b42570d))
- fixed child package exports ([76fe1fac](https://github.com/dereekb/dbx-components/commit/76fe1fac1b99853e705ae09bea6dee3e65d7338c))
- fixed circular dependency import ([9b68403c](https://github.com/dereekb/dbx-components/commit/9b68403cbc86612bc4f608e63028ced2d9853bdb))
- fixed ClickableFilterPreset type ([5bab6db5](https://github.com/dereekb/dbx-components/commit/5bab6db5f5bf97a373ef6f057effb6bfc28310d5))
- fixed converter issue ([de8874d4](https://github.com/dereekb/dbx-components/commit/de8874d4318ba4a0f2debadcfd0eb5acc29bc451))
- fixed converter on loadDocument() ([1e680ac8](https://github.com/dereekb/dbx-components/commit/1e680ac8c42f2777772b02fe7aa5a64d5abfa052))
- fixed convertHttpsCallableErrorToReadableError() ([78decc85](https://github.com/dereekb/dbx-components/commit/78decc857912ac1b259e59fdf9ade7e6976af8c9))
- fixed convertMailgunTemplateEmailRequestToMailgunMessageData() ([e378c74a](https://github.com/dereekb/dbx-components/commit/e378c74a28aadd674ff3749787aceed8a9ba6ab6))
- fixed createOrUpdateWithAccessor ([243d0d3d](https://github.com/dereekb/dbx-components/commit/243d0d3dd83c49171b2f7bea68142c9155f3723d))
- fixed createTestFunctionContextOptions() authData typing ([ba017cd5](https://github.com/dereekb/dbx-components/commit/ba017cd5c48fe96277c8c40a6c24d0f65d937214))
- fixed cronExpressionRepeatingEveryNMinutes ([63a7f8c4](https://github.com/dereekb/dbx-components/commit/63a7f8c48a2bf18c6b2ee712c47a71c95edbd35f))
- fixed DateBlockTiming class-validator validation/parsing ([23596cba](https://github.com/dereekb/dbx-components/commit/23596cba31818f16891e8105fa9f371a27b5ffd9))
- fixed dateBlockTiming() with 1 day distance ([53997068](https://github.com/dereekb/dbx-components/commit/5399706860274dfe005fb5939bd38468d4a4d7bf))
- fixed dateBlockTimingInTimezoneFunction() ([6d1bd8ab](https://github.com/dereekb/dbx-components/commit/6d1bd8abb3f79a4407c0bb4f62fa6e3e4c4a9604))
- fixed dateScheduleDateFilter() not handling a 0-0 range properly ([bb33a362](https://github.com/dereekb/dbx-components/commit/bb33a362ebe03bcfa55c2277c7f0faae05ba34b2))
- fixed dateScheduleDateFilter() timezone usage ([85bf0219](https://github.com/dereekb/dbx-components/commit/85bf0219d92e9806657df3cf2c1ad0f58504c138))
- fixed dateTimeField input issue ([58232002](https://github.com/dereekb/dbx-components/commit/582320020557595c1cfb797224e63b8307c0f41f))
- fixed dateTimeField() timeOnly mode not emitting value ([4f3548ba](https://github.com/dereekb/dbx-components/commit/4f3548ba9af137cbbfa5bc1a219f5a12bf661abf))
- fixed dbx-button icons styling ([f0b2b9f0](https://github.com/dereekb/dbx-components/commit/f0b2b9f08d972f9dbd1d932fe515a2f5ab998376))
- fixed dbx-mapbox-menu ([6c975fbc](https://github.com/dereekb/dbx-components/commit/6c975fbc7faad66c1b88afe3a54d267273e53051))
- fixed dbx-section-page-content height ([5f54f83b](https://github.com/dereekb/dbx-components/commit/5f54f83b9eb4d8aa383a2d4d88e758e9b19422a5))
- fixed dbx-two-column-right styling ([501dc7e5](https://github.com/dereekb/dbx-components/commit/501dc7e5fade0f9a2e20d2ad03de7271f5d1a57f))
- fixed dbxActionConfirm input ([b31a350e](https://github.com/dereekb/dbx-components/commit/b31a350ef62798dc4dc0e38e431c6f113d502376))
- fixed dbxActionEnforceModifiedDirective ([f889b874](https://github.com/dereekb/dbx-components/commit/f889b87463443024c718786e866ad9c9414a3662))
- fixed DbxCalendarScheduleSelectionStore ([14014af4](https://github.com/dereekb/dbx-components/commit/14014af43034173a4dc09d983a88b9228182a88b))
- fixed DbxFirebaseDevelopmentSchedulerService error handling ([3763fdf8](https://github.com/dereekb/dbx-components/commit/3763fdf830fbc6d0f2d134d0d66513b2dab39964))
- fixed dbxFormlyForm async validation issue ([afb3f964](https://github.com/dereekb/dbx-components/commit/afb3f964564b5b9795071b4f8fcfbaad9f37feec))
- fixed DbxFormMapboxLatLngFieldComponent input wrap ([0e4de7b6](https://github.com/dereekb/dbx-components/commit/0e4de7b6a56ee1fe67b8fa4a3cc983c263b97ae6))
- fixed DbxFormRepeatArrayTypeComponent mark touched ([eb1dcea8](https://github.com/dereekb/dbx-components/commit/eb1dcea88e2917092464d1ac4bb8bc4c2adf08d8))
- fixed DbxFormSourceDirective always mode ([ed73d44d](https://github.com/dereekb/dbx-components/commit/ed73d44debc11ecbb9f1923d79ee856b0527ad4b))
- fixed dbxFormSourceObservable() emission ([cf927b43](https://github.com/dereekb/dbx-components/commit/cf927b4345ab1bd9d8d0eb4addcd4f7b9efba9e0))
- fixed DbxMapboxMapDirective init issue ([789e3688](https://github.com/dereekb/dbx-components/commit/789e3688819168e358f14904fec55b012fbbd969))
- fixed DbxPartialPresetFilterMenuComponent generic ([11e099c7](https://github.com/dereekb/dbx-components/commit/11e099c72cad1bce6359757f7e4d613e2ae1f8fe))
- fixed DbxPickableItemField selection ([1c980e69](https://github.com/dereekb/dbx-components/commit/1c980e69d52a3381a1c7ee7a44f9c3b6c8d2b217))
- fixed DbxTwoColumnComponent styling ([77b4dd0e](https://github.com/dereekb/dbx-components/commit/77b4dd0e90371c0841794f31e2db0442bf76416d))
- fixed DbxTwoColumnSrefDirective input ([1df4eea0](https://github.com/dereekb/dbx-components/commit/1df4eea03dab2e8e2d2f247cf763dddb1631692f))
- fixed defaults of firestore-snapshot array fields ([8d388a9a](https://github.com/dereekb/dbx-components/commit/8d388a9a3216e2f7aca6144d9f5d0343d49ab5b0))
- fixed dependencies for release ([7c57c7ef](https://github.com/dereekb/dbx-components/commit/7c57c7ef5df664b8df2641fb3b50b82b3fb2c650))
- fixed documentRef not having converter configured ([308f3fa1](https://github.com/dereekb/dbx-components/commit/308f3fa18502c36915d65a7b9d7404a2c3bacbce))
- fixed enableMultiTabIndexedDbPersistence usage ([2c41552c](https://github.com/dereekb/dbx-components/commit/2c41552c6849cd7cae2405cd456d92bca265a5d3))
- fixed expandDateScheduleRange, dateBlockTimingForDateScheduleRange ([b758918c](https://github.com/dereekb/dbx-components/commit/b758918c140011392ceb69e42a78e40b2f55cc35))
- fixed expandUniqueDateBlocksFunction() scenario ([2341c246](https://github.com/dereekb/dbx-components/commit/2341c246c8c95c360501b2cf2166dfc65eab9122))
- fixed fetch issues ([8859b496](https://github.com/dereekb/dbx-components/commit/8859b4967030e9cecc336195f4d12551b9cc8d93))
- fixed filterKeyValueTupleFunction() keys filter ([dbf721fa](https://github.com/dereekb/dbx-components/commit/dbf721fa74eb1678e61a3d1c8164d412e65ee4b0))
- fixed flaky jwks rotation test ([56039ab4](https://github.com/dereekb/dbx-components/commit/56039ab4b4a8c424566c3aa1216bc0fed3804cc3))
- fixed function factory ([f722fb55](https://github.com/dereekb/dbx-components/commit/f722fb55c6948feb75d69eb1a7dc1eee6d731cb4))
- fixed generateRandomSetupPassword() generating decimals ([a2d67a87](https://github.com/dereekb/dbx-components/commit/a2d67a878ad7df80cf68a407de0c9ce6abdf8312))
- fixed getClosingValueFn usage in DbxPopoverComponent ([b9d3e3eb](https://github.com/dereekb/dbx-components/commit/b9d3e3eba83404b8add5e68d25df92a79ba99cc9))
- fixed grantFullAccessIfAuthUserRelated typings ([f83af852](https://github.com/dereekb/dbx-components/commit/f83af852f1fbad20ba86eb477d18f54e936dd41c))
- fixed improper behavior with asGetter()/getValueFromGetter() ([d2570e9a](https://github.com/dereekb/dbx-components/commit/d2570e9acb70d824e744d38657167a49f8ddc65f))
- fixed infinite loop in expandUniqueDateBlocks() ([7464f2d3](https://github.com/dereekb/dbx-components/commit/7464f2d33cb2f424a44cbfd3b8aa4a04a7304af6))
- fixed isLatestSuccessfulRoute() initial value ([fbde9194](https://github.com/dereekb/dbx-components/commit/fbde91949b9e331b58d3aa7907198b5431220952))
- fixed isLatLngPointWithinLatLngBound() ([d57c3693](https://github.com/dereekb/dbx-components/commit/d57c369393e337299fccd4fec64366d43fe3cd56))
- fixed issue in mergeLoadingStates() ([4206396d](https://github.com/dereekb/dbx-components/commit/4206396df9524bea79ba3b80d107aec7eb64a20a))
- fixed issue where empty queries were being appended to url ([2c787e83](https://github.com/dereekb/dbx-components/commit/2c787e83b505ef48b84034a22a66fcc2e478014f))
- fixed issue where firebaseDocumentStoreUpdateFunction() repeated ([c5e76c5c](https://github.com/dereekb/dbx-components/commit/c5e76c5c3f7f419cd5c9e9342f5a2fb01cf6abfb))
- fixed issue with AbstractFirestoreDocument stream$ ([3752d11f](https://github.com/dereekb/dbx-components/commit/3752d11f74d73b56759e513a57e5a7e979c223c1))
- fixed issue with allSuccessfulStates$ in itemAccumulatorInstance ([0396ac58](https://github.com/dereekb/dbx-components/commit/0396ac58fec1a24b703da520063e09c36bbfbf0a))
- fixed issue with easeTo input ([eb03604c](https://github.com/dereekb/dbx-components/commit/eb03604c99de548b9f8e6a6b0553a1bd27d209c9))
- fixed issue with example crud functions declaration ([8cb0aac5](https://github.com/dereekb/dbx-components/commit/8cb0aac5b744b7f2b8f1e07b3fa432b75d747a1e))
- fixed issue with min/max range in DbxCalendarScheduleSelectionStore ([871fc204](https://github.com/dereekb/dbx-components/commit/871fc2041b98c86c4da03eac6e2a6aaa84c54f70))
- fixed issue with ModelFirebaseCrudFunctionMapEntry for create ([a5ff2efe](https://github.com/dereekb/dbx-components/commit/a5ff2efe6b80fab53b7258af1feb4e0285d90e72))
- fixed issue with permission.service.grant.ts declaration order ([b6074041](https://github.com/dereekb/dbx-components/commit/b6074041cfeb69b9d17c39a4923fcae742defbab))
- fixed issue with snapshot falsy default values being ignored ([b433bc4a](https://github.com/dereekb/dbx-components/commit/b433bc4a63b04d5aab99e1cf67b058cf20e7cc6a))
- fixed issue with transactions in firestoreCollectionQueryFactory ([79a14563](https://github.com/dereekb/dbx-components/commit/79a1456336df8b9cce1755a40f704c8d8591d064))
- fixed isValidDateBlockIndex() ([0cdf4f87](https://github.com/dereekb/dbx-components/commit/0cdf4f8734a827ad77ab308512eacce61997c699))
- fixed LatLngStringRef ([88d9afe6](https://github.com/dereekb/dbx-components/commit/88d9afe64e3b6847cf965e0243674e3b057719ee))
- fixed LimitDateTimeInstance min value ([dc0c1b7c](https://github.com/dereekb/dbx-components/commit/dc0c1b7ce7977803d327ae9edbe76e3a7701ba36))
- fixed loadDocumentsForIdsFromValues() ([424f02f3](https://github.com/dereekb/dbx-components/commit/424f02f31bd1fce8f7b0c15e55ca47434f83ee90))
- fixed makeSingleItemFirestoreCollection ([4b8980de](https://github.com/dereekb/dbx-components/commit/4b8980ded100e67645b2deb3a2c12b08403fca62))
- fixed mapbox fields marked issue ([04e6e3a5](https://github.com/dereekb/dbx-components/commit/04e6e3a50ff02580264e802e320072155830eea2))
- fixed markerClasses usage in DbxMapboxMarkerComponent ([d0a0b183](https://github.com/dereekb/dbx-components/commit/d0a0b1832cfc621627f0ca60f91251fea6f0aa92))
- fixed model conversions ([18ac25f8](https://github.com/dereekb/dbx-components/commit/18ac25f8389d77fc724ea12eb9a3352eb72a9501))
- fixed modelFirebaseFunctionMapFactory() short specifier ([ae28afef](https://github.com/dereekb/dbx-components/commit/ae28afef90df357980ec516e250c5c82899fb896))
- fixed ModifyBeforeSetFirestoreDocumentDataAccessorWrapper ([68b5fff4](https://github.com/dereekb/dbx-components/commit/68b5fff454b8e30b838702c6747ed217937cf2ff))
- fixed modifyDateBlocksToFitRange() to fit to 0-0 range ([48031329](https://github.com/dereekb/dbx-components/commit/4803132951c34a8661425d2d4d7a89fc9b86e476))
- fixed nameField() not passing through expressions and config ([b6c9f76e](https://github.com/dereekb/dbx-components/commit/b6c9f76edba069939af61f5c0a0875994419118b))
- fixed package.json exports for util, firebase, and firebase-server ([04c1d9ab](https://github.com/dereekb/dbx-components/commit/04c1d9ab56dd2805aac154f7bf139ebca7dc4fb9))
- fixed primativeKeyStringDencoder() decoding ([427faf10](https://github.com/dereekb/dbx-components/commit/427faf1052163eedd84c84fdcaf83e62d0e627dd))
- fixed readKeysFunction array creation ([cab3ce70](https://github.com/dereekb/dbx-components/commit/cab3ce7013880b89e0cce91ebb470cf6404d1875))
- fixed redirectForUserIdentifierParamHook() ([1be07a3e](https://github.com/dereekb/dbx-components/commit/1be07a3ea9a0b7f8fbe583fe2914b5245cad7b98))
- fixed scheduler cron issue ([8a960475](https://github.com/dereekb/dbx-components/commit/8a960475ee43908f54d839e76c4d0320976a403d))
- fixed serve loop scripts ([b465b379](https://github.com/dereekb/dbx-components/commit/b465b3797ad7ff8cebaf988a0ddc86cad52c33fb))
- fixed slashPathType() ([180f2d64](https://github.com/dereekb/dbx-components/commit/180f2d645c10d772aa9ba4255ec3b0f2b8655096))
- fixed styling ([1e409fad](https://github.com/dereekb/dbx-components/commit/1e409fad90cf6a14b97acb31fd84bddf46206242))
- fixed styling with elevation in dbx-section ([c203ac8b](https://github.com/dereekb/dbx-components/commit/c203ac8bb58a1653a26507c1e82d94a924677073))
- fixed timezones changing for dateTimeField() ([b1d391d7](https://github.com/dereekb/dbx-components/commit/b1d391d7f3ee3deb82fd32aa141d7ebf08349bf6))
- fixed timezones with dateScheduleRangeField() ([421f64c5](https://github.com/dereekb/dbx-components/commit/421f64c5cf0c90d3076371450bc05d292d85d7db))
- fixed toggleField() description position ([a0ac2039](https://github.com/dereekb/dbx-components/commit/a0ac20398f32961173462a09ecdf046674e11aef))
- fixed two column reverseSizing ([c2987764](https://github.com/dereekb/dbx-components/commit/c2987764dac307f6a9743f9172a68ea78b6e5f0a))
- fixed typescript import issue introduced in 4.7 ([168c8b96](https://github.com/dereekb/dbx-components/commit/168c8b96077f4bf091a12415f3174b20687de22d))
- fixed typing issues ([f59cecf5](https://github.com/dereekb/dbx-components/commit/f59cecf5ae3b2c3577a9015a4b8606172c2da689))
- fixed util jest test declaration order ([3a05fb14](https://github.com/dereekb/dbx-components/commit/3a05fb148668e1791b4c30282752da98ae918cbb))
- fixed validation messages ([b53656dd](https://github.com/dereekb/dbx-components/commit/b53656dd4243d8f7b34d131d08ab1a2ba6a16b7b))
- fixed value selection field single value selection parser ([33f64cbe](https://github.com/dereekb/dbx-components/commit/33f64cbe3f22a2d9b7f6e4e939b956264aed34a0))
- fixed yearWeekCodeDateFactory() timezone issue ([c4a8514c](https://github.com/dereekb/dbx-components/commit/c4a8514c60414e7448f27ff4b5146508ac7baa0f))
- fixed zoom limits in DbxFormMapboxZoomFieldComponent ([a49e72ca](https://github.com/dereekb/dbx-components/commit/a49e72caec7cbe959fd310614917d72cd900bfdb))
- forge searchable field anchor click propagation ([93ac96bd](https://github.com/dereekb/dbx-components/commit/93ac96bdab6ccb12260f4519e9d4d51ab8a09cc9))
- gate oidc consent submit on auth state ([bf48547b](https://github.com/dereekb/dbx-components/commit/bf48547b675b549eca851e62f163b6b73fbf65a7))
- grantFullAccessIfAuthUserRelated() now takes in a document or model ([53563dd9](https://github.com/dereekb/dbx-components/commit/53563dd93a9ae25e84b6ef7f3e9d7ce857254bc6))
- hasAuthRoleHook fix ([e4749bae](https://github.com/dereekb/dbx-components/commit/e4749bae9a657d7cdc82974d129211392261aa3c))
- hasAuthStateData interface fix ([8ea59e3c](https://github.com/dereekb/dbx-components/commit/8ea59e3cba1e0407e6e1ed7b2dd4176a68c2fa09))
- import path fixes ([0b725584](https://github.com/dereekb/dbx-components/commit/0b7255845e2502ed28d7f6b81711765acd72b452))
- intphone field not marking form dirty/touched ([29b1ac8f](https://github.com/dereekb/dbx-components/commit/29b1ac8fe4c13d48374fbd901a3c55427d91d2c8))
- isIterable and useIterableOrValue treat string as a value ([388d6f02](https://github.com/dereekb/dbx-components/commit/388d6f022cf2937a9883df6a549167340243ac0e))
- itemAccumulatorInstance fix ([d67c9d19](https://github.com/dereekb/dbx-components/commit/d67c9d197934e0c4dee2070a2eea105a7114a56c))
- locked nx version in setup-project ([25a30ed0](https://github.com/dereekb/dbx-components/commit/25a30ed089376e1c99d06424f46039479798eb5c))
- login button content not rendering ([a13cc472](https://github.com/dereekb/dbx-components/commit/a13cc4725cc59de03a178a368c581dbf48876364))
- mapbox drawer button background not rendering ([59592051](https://github.com/dereekb/dbx-components/commit/59592051d12e98821e54613d26973404c6ba95f8))
- onScheduleWithNestApplicationFactory fix ([3736e307](https://github.com/dereekb/dbx-components/commit/3736e307056c306b23a617ade294273059c1a323))
- optional analytics provider crashes on missing token ([a9a3feb8](https://github.com/dereekb/dbx-components/commit/a9a3feb831d6e8b566d5279ea7e550b7bec0ce4e))
- optionalFirestoreDate() ([58e170c9](https://github.com/dereekb/dbx-components/commit/58e170c9d890e3953c316b78cd01fb9b49f3bf29))
- package.json to reduce vulnerabilities ([#44](https://github.com/dereekb/dbx-components/issues/44)) ([f1bfbad3](https://github.com/dereekb/dbx-components/commit/f1bfbad3557033da982c3a2f3f26c70ebd73f0ae)), closes [#44](https://github.com/dereekb/dbx-components/issues/44)
- prevented duplicate item accumulation on page re-emission ([5c41aee4](https://github.com/dereekb/dbx-components/commit/5c41aee4ccab715342e6b29566207acca53937de))
- removed angular directives from abstractAsyncWindowLoadedService ([4ab7a740](https://github.com/dereekb/dbx-components/commit/4ab7a740ed1c50965e832f64edc5ce4ee6a60faa))
- removed async from hasNewUserSetupPasswordInRequest() ([5c7bf2ea](https://github.com/dereekb/dbx-components/commit/5c7bf2eafeed05d2e2d7f873af4ca3f38fe1efd0))
- removed console print from DbxFirebaseEmulatorService ([8e5b6221](https://github.com/dereekb/dbx-components/commit/8e5b6221dc193c7a3eb729cd9932b4817f1097d9))
- removed leading ./ from package bin paths ([7960381f](https://github.com/dereekb/dbx-components/commit/7960381fb0c42beb4d096fd2e0a2fa2710f89ed7))
- removed OnCallModelAnalyticsResolver to fix test hang ([eb7d5e2a](https://github.com/dereekb/dbx-components/commit/eb7d5e2a84c615499f0a2822254f440c6fc377e1))
- removed shareReplay from document.rxjs.ts streaming functions ([2377156c](https://github.com/dereekb/dbx-components/commit/2377156cffcd4d69643a1619d5762f6f7d7b5a3e))
- resolved DST boundary bugs in date timezone calculations ([363f7ddf](https://github.com/dereekb/dbx-components/commit/363f7ddf675a081be3cabc99ec159c4d37cd774c))
- restored missing calendars views ([e6146458](https://github.com/dereekb/dbx-components/commit/e6146458e5badd09c5b3e75c727802fe41015462))
- restored runtime null guards removed by lint ([d9b38b8f](https://github.com/dereekb/dbx-components/commit/d9b38b8fac9f1ee121a01a239ecef02122281590))
- reverted [...Set] spreads to Array.from() ([fc712166](https://github.com/dereekb/dbx-components/commit/fc712166daaeecad86411f4dd8e38c9de19989f6))
- setup project scss fix ([9bfb6fde](https://github.com/dereekb/dbx-components/commit/9bfb6fde0443a946804d469b1e916c96f6201136))
- setup project template replacement fixes ([fbe36cf8](https://github.com/dereekb/dbx-components/commit/fbe36cf89882fcab5bbe77678f72d4e9e4499502))
- setup-project fix ([9406bfc0](https://github.com/dereekb/dbx-components/commit/9406bfc026616723bc0ea6388a2b47512455a733))
- setup-project fixes ([d7003703](https://github.com/dereekb/dbx-components/commit/d700370301483b64cf561ab3fe9b0492c697cd45))
- setup-project fixes ([5e174fd9](https://github.com/dereekb/dbx-components/commit/5e174fd9b82b4769d5e2d0eac0fe334814a6d26a))
- setup-project proxy config path fix ([db6c9860](https://github.com/dereekb/dbx-components/commit/db6c986065d9852ecd69483a251047fdc87314e7))
- setup-project string replace ([fd7adf1a](https://github.com/dereekb/dbx-components/commit/fd7adf1a0578e8403737b38363a1d310d05b3586))
- setup-project string replace ([a72284f0](https://github.com/dereekb/dbx-components/commit/a72284f087fad509b9920e1fba8d6a7c9f354718))
- style fix for mapbox marker css classes ([2abddd19](https://github.com/dereekb/dbx-components/commit/2abddd192854f9a2a256514cfc9dc42d0bcbcdc3))
- styling fix ([c883a2cc](https://github.com/dereekb/dbx-components/commit/c883a2cc9599405b0577006d2897cb26bcbb6f87))
- terminate firestore before cleanup in test teardown ([700f7372](https://github.com/dereekb/dbx-components/commit/700f7372093c9f1584151d1ee6c82a10a3ba9da6))
- updated DbxFormlyFormComponent to poll for touched changes ([51670e4c](https://github.com/dereekb/dbx-components/commit/51670e4c1cffd7f66665732a425ef071e995896b))
- updated force-start-release.sh ([3b4da487](https://github.com/dereekb/dbx-components/commit/3b4da487bd58265b67e4ee6b1cda287e076a28a7))
- updated GrantRolesOtherwiseFunction to allow returning Maybe ([552bb9c4](https://github.com/dereekb/dbx-components/commit/552bb9c488c0f11aa1aca885d00c5a7c2a199591))
- updated types for @Export() types due to jest issue ([24b2b65b](https://github.com/dereekb/dbx-components/commit/24b2b65b6067aafd3133f88d23f16f62a20e6068))
- useAsync typings fixes with Maybe ([68f38a46](https://github.com/dereekb/dbx-components/commit/68f38a46559e48c61e8449622e69f2e610aeb1b4))
- used fixed date in getDateCellTimingFirstEventDateRange test ([8ee25396](https://github.com/dereekb/dbx-components/commit/8ee25396fcf2e69ddc1162b085f163f60ed745ba))
- util import path fixes ([e786b207](https://github.com/dereekb/dbx-components/commit/e786b207916e7679d321a5bf03f7bc00d4539234))
- versions bump ([3a1a6cf5](https://github.com/dereekb/dbx-components/commit/3a1a6cf5e594a9cd8dfb504fc2e14f561abe8413))
- wrapper props fix ([b002f398](https://github.com/dereekb/dbx-components/commit/b002f3985c40684eb25cf05f2d703cf08bf53758))
- zoho-cli test invalid choice checks pass --fields ([f7d036df](https://github.com/dereekb/dbx-components/commit/f7d036df852e91c857bba6d1d395e15d7a758f83))


### Build System

- **$workspace:** update deps to latest minor versions ([3df46308](https://github.com/dereekb/dbx-components/commit/3df4630876605ff90a9329bf9869ed29c208f24b))
- added .eslintrc.json to setup-project templates ([412bcd53](https://github.com/dereekb/dbx-components/commit/412bcd538bdfe9c15b9924ff18f3fcf55dc64fc2))
- added additional logging to setup-project.sh ([b12147ba](https://github.com/dereekb/dbx-components/commit/b12147bad2ab4eb3833f5d250beb18d5aa3cfa96))
- added additional merging tool ([9dba1dd9](https://github.com/dereekb/dbx-components/commit/9dba1dd977f3c246742652220d72dc4e3265e9d2))
- added angular-calendar to setup-project ([06fdd7e4](https://github.com/dereekb/dbx-components/commit/06fdd7e462ff81b4f23625242db828803aa82c72))
- added circleci/node usage ([3c222a1c](https://github.com/dereekb/dbx-components/commit/3c222a1cad3757747ba53a25cee362e1071bff3e))
- added core-js as a dependency ([67db0821](https://github.com/dereekb/dbx-components/commit/67db08215463a5b450907199f6f539a0966937d5))
- added dbx-form-mapbox project ([c76eef2d](https://github.com/dereekb/dbx-components/commit/c76eef2d70539496a9d13b5a545ed1532dd819ae))
- added ESM export to @dereekb/date ([cd2afeb1](https://github.com/dereekb/dbx-components/commit/cd2afeb1e66a21c907829ab6d77e79ef763152b0))
- added ESM export to @dereekb/firebase-server ([6371d674](https://github.com/dereekb/dbx-components/commit/6371d6742ea445b3fd889b2acfa6390361b04dcb))
- added ESM export to @dereekb/model, @dereekb/firebase ([fc1310cb](https://github.com/dereekb/dbx-components/commit/fc1310cbc61c997f7725590464ef445bacbb7bab))
- added ESM export to @dereekb/model, @dereekb/firebase ([9a6f581f](https://github.com/dereekb/dbx-components/commit/9a6f581f9eb2bd4866c207c2bac4e3f8f6554033))
- added ESM export to @dereekb/rxjs ([e2d4c7e4](https://github.com/dereekb/dbx-components/commit/e2d4c7e499f8f469384aba84bb411380b7542080))
- added ESM export to @dereekb/util ([8937ab7c](https://github.com/dereekb/dbx-components/commit/8937ab7ce5cd1eed6f6bcf64499fcddd647e7dd4))
- added explicit build for dbx-web-mapbox ([d75d4473](https://github.com/dereekb/dbx-components/commit/d75d44739eba89dc0da70d63847b272201dcac39))
- added license to dist outputs ([7f8345b2](https://github.com/dereekb/dbx-components/commit/7f8345b218c346cd86d3110678b2a48904cb40a9))
- added lint-fix step to exporting ([7d873546](https://github.com/dereekb/dbx-components/commit/7d87354670ab44df2c2d169a5dbd34790f758619))
- added merge-in-main.sh ([b366c769](https://github.com/dereekb/dbx-components/commit/b366c7699baf361194ddc96a34f63597ef240b97))
- added offline support ([68321092](https://github.com/dereekb/dbx-components/commit/68321092395a01dd50ef6df57b02ca03839b91d7))
- added prettier pre-commit update ([7f11e4d0](https://github.com/dereekb/dbx-components/commit/7f11e4d05224540d72f31870ccc7ae683ddd1aa9))
- added return-await rule and lint fixes ([b77e288b](https://github.com/dereekb/dbx-components/commit/b77e288b9bfdde8761c99c05f816d6470e3f8439))
- added run-tests to the nx cacheable operations ([8b1945e4](https://github.com/dereekb/dbx-components/commit/8b1945e4d1161a92a458f93a5f9c019de09e8000))
- added singleProjectMode false to emulators config ([797d39d0](https://github.com/dereekb/dbx-components/commit/797d39d0e8aa9e930119ec2042ff738ffa8cf260))
- added test-setup.ts to setup-project.ts ([1ea5ddd8](https://github.com/dereekb/dbx-components/commit/1ea5ddd8415cb5bfed48b6008ca9ce5b57b52904))
- added workaround for firebase-tools regression ([02ae0dc9](https://github.com/dereekb/dbx-components/commit/02ae0dc9246c325722054c851b310ae98df388a3))
- build and package.json fixes ([c703a452](https://github.com/dereekb/dbx-components/commit/c703a4526534a0019362321c0884f4fda96a6520))
- build fix ([bae821af](https://github.com/dereekb/dbx-components/commit/bae821af0c0743631a7eb480a50dad623593dc61))
- build fix ([061c32fe](https://github.com/dereekb/dbx-components/commit/061c32fefe1c3776be1808534ad75013f61df6b1))
- build fix ([48ccfe2a](https://github.com/dereekb/dbx-components/commit/48ccfe2a6184cd51fe78641cbe6a7e6003693971))
- build fix ([85269545](https://github.com/dereekb/dbx-components/commit/852695455a8b0e0355aeb34a1d4dae5de5ae91ce))
- build fix ([5087f734](https://github.com/dereekb/dbx-components/commit/5087f7348df34507b5099883708059d9b25d721f))
- build fix ([1b835194](https://github.com/dereekb/dbx-components/commit/1b8351940df737777a26b6256834af500bf18bcc))
- build fix ([c50d31a4](https://github.com/dereekb/dbx-components/commit/c50d31a455a12e10d7c4e9d51f2ed097366d2ebd))
- build fixes ([9fcc104d](https://github.com/dereekb/dbx-components/commit/9fcc104d63f4737129368a2c878176498d672494))
- build fixes ([acd969d4](https://github.com/dereekb/dbx-components/commit/acd969d4d6830e1b3f32b971c80c6ca1e50b4d46))
- build loop fix ([50cb9029](https://github.com/dereekb/dbx-components/commit/50cb9029f8fa30015ed1e41c86bf9d61457c881f))
- bump angular-calendar version ([a617a398](https://github.com/dereekb/dbx-components/commit/a617a398eeda28421980cddfa0e72542fdab1cc3))
- bump nx version to 14.5.10 ([c47692ff](https://github.com/dereekb/dbx-components/commit/c47692ffb58a41e097ef4cb4c0a4931de4f65318))
- bumped @ngx-formly version ([b4cd90ca](https://github.com/dereekb/dbx-components/commit/b4cd90caf4ae32b8d8568374d70eebef5b33da54))
- bumped date-fns version to ^2.29.0 ([92e06cf3](https://github.com/dereekb/dbx-components/commit/92e06cf35dfdaa2e9475523e789c21f86306a3d9))
- bumped firebase tools version ([e3dcfdd2](https://github.com/dereekb/dbx-components/commit/e3dcfdd22be108bc6bea501cc09e94648873ba48))
- bumped firebase-tools version ([fa1f2d63](https://github.com/dereekb/dbx-components/commit/fa1f2d63491811a5f8502599388adaab31b46eb6))
- bumped firebase-tools version ([2d448c5c](https://github.com/dereekb/dbx-components/commit/2d448c5c3deea8feb82180c5aeaedb2fdf9a105a))
- bumped firebase-tools version to 13 ([cb5a7a6e](https://github.com/dereekb/dbx-components/commit/cb5a7a6eb30ec163ec602a4ded436f12003413d0))
- bumped node docker container version to 16.15 ([4adbd655](https://github.com/dereekb/dbx-components/commit/4adbd6559ef0d973eed142ed2e866ec310ddd1f7))
- **dbx-components-mcp:** lint fix ([19f0b1cd](https://github.com/dereekb/dbx-components/commit/19f0b1cd2144a3c35613ecc71423397e72bc3b6a))
- dbx-form build fix ([a2ee19aa](https://github.com/dereekb/dbx-components/commit/a2ee19aa4c23cf9b08c867d76ccac61763031b35))
- dependency fixes ([0b3b8fd6](https://github.com/dereekb/dbx-components/commit/0b3b8fd6a6238e4a978d796eb07ee2f623630e85))
- dependency updates ([00cafddc](https://github.com/dereekb/dbx-components/commit/00cafddcad75f132bb24a13fba5fbd0c8b62a455))
- dependency updates ([4dee8441](https://github.com/dereekb/dbx-components/commit/4dee84414b1ee9d4d95cda36e03e2aab946f3196))
- dependency version updates ([37f839da](https://github.com/dereekb/dbx-components/commit/37f839da4f3133a6b34e06dd5162ad76946a66e0))
- deploy fixes ([acb79c47](https://github.com/dereekb/dbx-components/commit/acb79c47c68128afff000be12adf4006115555a4))
- dev dependency bump ([54fbc426](https://github.com/dereekb/dbx-components/commit/54fbc4267ead8f5cd9a97b5b901a33f5f815c701))
- disabled cypress install in Dockerfile ([82cfb42b](https://github.com/dereekb/dbx-components/commit/82cfb42beaaef4cd098245395703a468a20248b2))
- disabled nx cache for releases ([def97c6c](https://github.com/dereekb/dbx-components/commit/def97c6cd28daf3376b03a2a4b0b445e7fdbd0dd))
- disabled RRule tests ([be107aab](https://github.com/dereekb/dbx-components/commit/be107aab21ac186fa5cdb08604e480e873c75312))
- downgrade firebase-functions dependency ([58020a17](https://github.com/dereekb/dbx-components/commit/58020a172acf02b5fdd59759e7e101e5415851e9))
- expanded eslint rules and plugins ([1503450d](https://github.com/dereekb/dbx-components/commit/1503450d388db10599657a2a1e25e65590e3777c))
- firebase development server ([92a3b9d8](https://github.com/dereekb/dbx-components/commit/92a3b9d801624537eb348ba36990cf3b83050fa6))
- firebase tools downgrade ([d835cf7b](https://github.com/dereekb/dbx-components/commit/d835cf7b0e52bef0df2d906913b339880bafae11))
- fix ([ff6ca3ef](https://github.com/dereekb/dbx-components/commit/ff6ca3ef638879f0ea8a75cceca02a7963a3aeab))
- fix make-env.js ([740669d0](https://github.com/dereekb/dbx-components/commit/740669d0406f4609ba688d4014d8cd71cee03281))
- fixed angular dependencies ([2b60defa](https://github.com/dereekb/dbx-components/commit/2b60defa37d00f533d3a23e379351b7875d12f72))
- fixed implicit dependency declarations ([b437304f](https://github.com/dereekb/dbx-components/commit/b437304ff96513aa1bf516e2f339828093c0c1fd))
- fixed make-env.js ([efa01b2d](https://github.com/dereekb/dbx-components/commit/efa01b2df0b90586483ab68cfd200ef92df0a214))
- formatted project ([4b0699c4](https://github.com/dereekb/dbx-components/commit/4b0699c411f04d08982947f981993a87edbe2b46))
- ignore lint-fix-step returning errors ([fd7bd2a3](https://github.com/dereekb/dbx-components/commit/fd7bd2a3f35b7150012bab8178dfa216eb7f3fc8))
- Jest 28 ([#12](https://github.com/dereekb/dbx-components/issues/12)) ([4d686dc9](https://github.com/dereekb/dbx-components/commit/4d686dc9a099cc7a649a6c2766a669c42464f9bc)), closes [#12](https://github.com/dereekb/dbx-components/issues/12)
- lint fix ([65c35953](https://github.com/dereekb/dbx-components/commit/65c3595368d8ea77dadea8048ef3127c1ca4cda9))
- lint fix ([873422e9](https://github.com/dereekb/dbx-components/commit/873422e992ff9c6dd0e419b438ad0c1b2c57234b))
- lint fix ([4c892384](https://github.com/dereekb/dbx-components/commit/4c892384af65b8a491f58cab1fd3c1b981fed2d3))
- lint fix ([366d95f4](https://github.com/dereekb/dbx-components/commit/366d95f48e9fb0c0fe802415b315851d672b53fa))
- lint fix ([46d9ad19](https://github.com/dereekb/dbx-components/commit/46d9ad1959b55508b7766cc097672883ee6b0c8e))
- lint fix ([d3768833](https://github.com/dereekb/dbx-components/commit/d37688338d3021d8d46ad29415a3b9c47f38a34a))
- lint fix ([31ad7c0f](https://github.com/dereekb/dbx-components/commit/31ad7c0f1a3a8d5abacb884dd4af8ea6e6dafc6f))
- lint fix ([01b33c02](https://github.com/dereekb/dbx-components/commit/01b33c0214d7963822dbf3cb7df822a788958e2e))
- lint fix ([61238543](https://github.com/dereekb/dbx-components/commit/61238543024fffaf986c7d297d88fc9206c36502))
- lint fix ([b0a2a3c5](https://github.com/dereekb/dbx-components/commit/b0a2a3c5e575bdf34eb9b2e59425814859ec3ece))
- lint fix ([de0b6d1c](https://github.com/dereekb/dbx-components/commit/de0b6d1c5b523ec652fcca1c4fed06de9bb252ef))
- lint fix ([02bb7ce9](https://github.com/dereekb/dbx-components/commit/02bb7ce97169a7b0b58a781c9700260a9f02a433))
- lint fix ([a6f03496](https://github.com/dereekb/dbx-components/commit/a6f034962b8054b66f9c50f887c267bf94614d73))
- lint fix ([48618689](https://github.com/dereekb/dbx-components/commit/48618689d1ee25f5bbfd76067df998f82fb835b3))
- lint fix ([2f2d089a](https://github.com/dereekb/dbx-components/commit/2f2d089a4d87895b17eee07c6844582d7eef0d2e))
- lint fix ([07322484](https://github.com/dereekb/dbx-components/commit/073224840d9c6aad5c8701234755abd11986fea5))
- lint fix ([0f5f9509](https://github.com/dereekb/dbx-components/commit/0f5f9509b1fe9d2d1ed83e6bc33ae716cdee92e5))
- lint fix ([83af38e2](https://github.com/dereekb/dbx-components/commit/83af38e200a08af50e5fcad8cd0a5a768fdbc028))
- lint fix ([67fbda55](https://github.com/dereekb/dbx-components/commit/67fbda557b6cc322e3a5d7d6673e1da2b60a9ab2))
- lint fix ([696ca928](https://github.com/dereekb/dbx-components/commit/696ca928fc586f6885e869a78059203801689eae))
- lint fix ([f73b60ea](https://github.com/dereekb/dbx-components/commit/f73b60ea64988406221b69ffd57410608911919b))
- lint fix ([84038473](https://github.com/dereekb/dbx-components/commit/840384734db06d303b093cc580aef72be017ac2d))
- lint fix ([68485815](https://github.com/dereekb/dbx-components/commit/68485815da050805e4f6fc739de08c9c2621d197))
- lint fix ([8ddc05b3](https://github.com/dereekb/dbx-components/commit/8ddc05b3885d30ecccc7851f559edf5287e41f8c))
- lint fix ([e3d65e07](https://github.com/dereekb/dbx-components/commit/e3d65e07fd8d2097505bbc8ddf18ff646c895236))
- lint fix ([cc09e358](https://github.com/dereekb/dbx-components/commit/cc09e3582b11fb9984a169dd8c024310ff2e767b))
- lint fix ([91fdc26f](https://github.com/dereekb/dbx-components/commit/91fdc26ffd138b308d885bd1e5f67a4e1febd648))
- lint fix ([095cb18c](https://github.com/dereekb/dbx-components/commit/095cb18c6434c85c48f0b4c960062a95a6e53088))
- lint fix ([b6dc1861](https://github.com/dereekb/dbx-components/commit/b6dc18618f108c9e0044e0e18cee65f6a303dfe9))
- lint fix ([447ae992](https://github.com/dereekb/dbx-components/commit/447ae99260671cabc911da83ab647603fd374ee0))
- lint fix ([640c0944](https://github.com/dereekb/dbx-components/commit/640c09442a53d9671f1844da8a08ecf8f62ca707))
- lint fix ([94ccaa53](https://github.com/dereekb/dbx-components/commit/94ccaa5396fc5d59eb53fdd6db851c0a60366dc0))
- lint fix ([4f884230](https://github.com/dereekb/dbx-components/commit/4f8842309fd6c3a7526e6a2daaba66bab128cba1))
- lint fix ([a3d1adfe](https://github.com/dereekb/dbx-components/commit/a3d1adfeb51a7c33e1386c0113acc2325df3213f))
- lint fix ([a7308961](https://github.com/dereekb/dbx-components/commit/a73089617f746b4830d74acabef363e8a3c5d534))
- lint fix ([85b5c60e](https://github.com/dereekb/dbx-components/commit/85b5c60e5d7fb62fcb5c8b3293e8cdfc1474327e))
- lint fix ([70a398f8](https://github.com/dereekb/dbx-components/commit/70a398f80bf404be5b98d0b0ab4d0916c9702f9e))
- lint fix ([03368695](https://github.com/dereekb/dbx-components/commit/033686955673ee6b2b1d0a9c40bff8ab3ef90dca))
- lint fix ([5758fbaa](https://github.com/dereekb/dbx-components/commit/5758fbaa9a3afcd7360f9c25780fc13c3cad39fa))
- lint fix ([c971682e](https://github.com/dereekb/dbx-components/commit/c971682e7992b9ecc16d1fc8b42194ea46097f62))
- lint fix ([4b69e027](https://github.com/dereekb/dbx-components/commit/4b69e027b3ed682f9fd9d373ab7d64a068efb2fc))
- lint fix ([6788cddb](https://github.com/dereekb/dbx-components/commit/6788cddba8c731c1a2b945b3dd003e6f2c6209d8))
- lint fix ([633d3126](https://github.com/dereekb/dbx-components/commit/633d31268cadcffc62f9b6221121a0e1c2e5fcd2))
- lint fix ([ca8da811](https://github.com/dereekb/dbx-components/commit/ca8da811080ad595c85a34c3b7749cce86cac8dd))
- lint fix ([8979580e](https://github.com/dereekb/dbx-components/commit/8979580e9f3f851fcf37aa07bad357c8f45a0854))
- lint fix ([b701b951](https://github.com/dereekb/dbx-components/commit/b701b951e544290936c392ba5bb874b88e8fd74b))
- lint fix ([f7a964e6](https://github.com/dereekb/dbx-components/commit/f7a964e66026b323433e82f576408898f1828aeb))
- lint fix ([71c7a236](https://github.com/dereekb/dbx-components/commit/71c7a2361206985128d68a3867ca1a107822b980))
- lint fix ([d2b755c4](https://github.com/dereekb/dbx-components/commit/d2b755c443b33f0da724736848079d0b428b22c3))
- lint fix ([c8b1a69e](https://github.com/dereekb/dbx-components/commit/c8b1a69e6ee11679820d28ebdad5a946d387e155))
- lint fix ([9011974f](https://github.com/dereekb/dbx-components/commit/9011974f8fb9bdfc477f32686d8ae8e31a94c25d))
- lint fix ([6d748815](https://github.com/dereekb/dbx-components/commit/6d748815b216e37ea23f64477d8da667c4cef427))
- lint fix ([fa07244c](https://github.com/dereekb/dbx-components/commit/fa07244cde3ada9ab45c83952e3766ddd07899e2))
- lint fix ([b52db209](https://github.com/dereekb/dbx-components/commit/b52db20900c3bb9eef0b9434abb281be767fdcbe))
- lint fix ([5593ee88](https://github.com/dereekb/dbx-components/commit/5593ee889b5a1331b50dfee762a62b1ac84e21a2))
- lint fix ([e3f64e45](https://github.com/dereekb/dbx-components/commit/e3f64e450d92f181282713bb914ca0d64b73b348))
- lint fix ([e9c824f9](https://github.com/dereekb/dbx-components/commit/e9c824f96b7321033ce51769a31cc90fac0ccaac))
- lint fix ([2e9c6939](https://github.com/dereekb/dbx-components/commit/2e9c693956915d864fd16bc7095039d5495ef5eb))
- lint fix ([9542ec5d](https://github.com/dereekb/dbx-components/commit/9542ec5d969f9f24704ac8af32d1a5057789e1e4))
- lint fix ([04528e9d](https://github.com/dereekb/dbx-components/commit/04528e9d66c92c8ef1d09afc11eceb1b52ca5cc1))
- lint fix ([77ec2e1f](https://github.com/dereekb/dbx-components/commit/77ec2e1f161656530cc7e74e484bea738e3df889))
- lint fix ([594384ba](https://github.com/dereekb/dbx-components/commit/594384ba8c357bb0fe3d5274148908e39cff2caa))
- lint fix ([e3435161](https://github.com/dereekb/dbx-components/commit/e34351612ae73846944a9cc7e1e5758cc9a54835))
- lint fix ([94cb893e](https://github.com/dereekb/dbx-components/commit/94cb893e169e3c5a50dbc44c7f6d6851645abe6a))
- lint fix ([c89250b0](https://github.com/dereekb/dbx-components/commit/c89250b05c311599df7056bcdf367f6c900020cf))
- lint fix ([123510e6](https://github.com/dereekb/dbx-components/commit/123510e60a53a864da18be7d446869fffb3c8c5d))
- lint fix ([7a61ad3a](https://github.com/dereekb/dbx-components/commit/7a61ad3ad1226dfe7426f75452c32204c64e6394))
- lint fix ([100e2531](https://github.com/dereekb/dbx-components/commit/100e2531ddd6a4cc03949662ca944e48bf9edec1))
- lint fix ([172e12a6](https://github.com/dereekb/dbx-components/commit/172e12a6d607f84fafd72f4458061e7266311f3c))
- lint fix ([1fb20c02](https://github.com/dereekb/dbx-components/commit/1fb20c023f9d36db7280a3143ea7759634390869))
- lint fix ([c0dc8379](https://github.com/dereekb/dbx-components/commit/c0dc8379f3c412202eed819cee1fd2032cfa0769))
- lint fix ([dc3b9574](https://github.com/dereekb/dbx-components/commit/dc3b95744384b9ee6feeb1684943dd2e1ad82a70))
- lint fix ([103e3a05](https://github.com/dereekb/dbx-components/commit/103e3a05a48f32dfadaf9bc4a1acc0015fbd76b6))
- lint fix ([d96f63b7](https://github.com/dereekb/dbx-components/commit/d96f63b71236a61488380ab69f69b895b29d2934))
- lint fix ([a99c0efb](https://github.com/dereekb/dbx-components/commit/a99c0efb7f86e9d9615f5fb25d12149653fd1d50))
- lint fix ([3c82b7ac](https://github.com/dereekb/dbx-components/commit/3c82b7ac26de748f196c5a5bad8a87a7a1e82cc5))
- lint fix ([1d7652b2](https://github.com/dereekb/dbx-components/commit/1d7652b21c518400fa6e828f4d793740814c1a3f))
- lint fix ([6c2914f0](https://github.com/dereekb/dbx-components/commit/6c2914f06f9cf5a7cff40f524e645fdee15e94d5))
- lint fix ([5af22c4f](https://github.com/dereekb/dbx-components/commit/5af22c4f3ff12bb6f1e0f2a8e92d5c334684e186))
- lint fix ([bc7b43fe](https://github.com/dereekb/dbx-components/commit/bc7b43fe6275828fda7820da7a4ef67d0d2a0697))
- lint fix ([5ada99ab](https://github.com/dereekb/dbx-components/commit/5ada99ab03533627c0b04fd2bb880ee656025715))
- lint fix ([0489982f](https://github.com/dereekb/dbx-components/commit/0489982f0d896dc00859cb7f386521e010e2b065))
- lint fix ([f9f66be7](https://github.com/dereekb/dbx-components/commit/f9f66be73b9834e3073f9114a3256fb7fdba379f))
- lint fix ([e7fa91b1](https://github.com/dereekb/dbx-components/commit/e7fa91b188c842aa30eab6d9025b64e58fd048ee))
- lint fix ([e0d7218c](https://github.com/dereekb/dbx-components/commit/e0d7218cf1b94c79bb48d7fed7bbe6c70e5597df))
- lint fix ([12935d15](https://github.com/dereekb/dbx-components/commit/12935d1524cae7d34edcbbb516f5430ce0b4b2a3))
- lint fix ([0d01752c](https://github.com/dereekb/dbx-components/commit/0d01752c8a6205c0aec22dc1988aec882e67a22a))
- lint fix ([1c64b00f](https://github.com/dereekb/dbx-components/commit/1c64b00fc883a2dbd7e5381f1bcfa68997a71c1d))
- lint fix ([0ee15c57](https://github.com/dereekb/dbx-components/commit/0ee15c578b466acc8693bf774e34e3ea2abd1ec6))
- lint fix ([e3221623](https://github.com/dereekb/dbx-components/commit/e32216236ab6e69efde752ac27be4551755a24f9))
- lint fix ([b4a804bd](https://github.com/dereekb/dbx-components/commit/b4a804bdd88cdc103ca04c0def831a041dcd9a2b))
- lint fix ([1fdae317](https://github.com/dereekb/dbx-components/commit/1fdae3174c35ff61847c9d37d3cdbf6be5201cbe))
- lint fix ([49222e52](https://github.com/dereekb/dbx-components/commit/49222e528ac24986a44d9f4c665cd723cb9debaa))
- lint fix ([071cd462](https://github.com/dereekb/dbx-components/commit/071cd46293e8f57c7bfdff557f5098fc15fecf75))
- lint fix ([809c9697](https://github.com/dereekb/dbx-components/commit/809c9697412eccb8a5dfb6469aecd76864242065))
- lint fix ([18ea5d10](https://github.com/dereekb/dbx-components/commit/18ea5d10cfaa3f96c19a556d7dd7fdf93329e5c2))
- lint fix ([4740f6c3](https://github.com/dereekb/dbx-components/commit/4740f6c37f7c5c3af1009afa4e6069b379ebc9c9))
- lint fix ([cf3fb092](https://github.com/dereekb/dbx-components/commit/cf3fb0920d1700731f0e25d3b7cab75993a2111c))
- lint fix ([d529aefb](https://github.com/dereekb/dbx-components/commit/d529aefb0c9c38387014cd2053f5107438e88e1a))
- lint fix ([66653779](https://github.com/dereekb/dbx-components/commit/66653779f0a02243da521bd2b3bcbac930c2149d))
- lint fix ([b9984a13](https://github.com/dereekb/dbx-components/commit/b9984a13e1009a89f38a3ea7feadb4f59574418d))
- lint fix ([e9a1a304](https://github.com/dereekb/dbx-components/commit/e9a1a304771ecbf5c8981f3c7f4610557fb77033))
- lint fix ([d91235fc](https://github.com/dereekb/dbx-components/commit/d91235fc57a3bbdb615768bf86be11b3424bc836))
- lint fix ([b62dcaac](https://github.com/dereekb/dbx-components/commit/b62dcaacff162f5bb34d1398e8cbc574521b3ec9))
- lint fix ([88d6a889](https://github.com/dereekb/dbx-components/commit/88d6a8895c6c0922b37bf0916571b2aab6723128))
- lint fix ([152cd439](https://github.com/dereekb/dbx-components/commit/152cd439e9c639f7ffd199928aaa3c6a12a5a90d))
- lint fix ([02d33b79](https://github.com/dereekb/dbx-components/commit/02d33b7939bc76fc6f5e8a8817ec197886574c9e))
- lint fix ([17f15961](https://github.com/dereekb/dbx-components/commit/17f159612c9357f0be3375f262ff44fc9eefd32e))
- lint fix ([aec8bb94](https://github.com/dereekb/dbx-components/commit/aec8bb94883b9118b85d4a85e965bdb46e6b481e))
- lint fix ([aa249357](https://github.com/dereekb/dbx-components/commit/aa249357e37023e9774e811bf2472aab89f15cd9))
- lint fix ([8211c42c](https://github.com/dereekb/dbx-components/commit/8211c42c959daccb11e85d0079e7a654018c066f))
- lint fix ([d78b8c9c](https://github.com/dereekb/dbx-components/commit/d78b8c9c973ae0c583a6a4615557faebee62d0f5))
- lint fix ([c5e7ddca](https://github.com/dereekb/dbx-components/commit/c5e7ddcab1932ab7071557908e55c996601c0d5d))
- lint fix ([7f45125d](https://github.com/dereekb/dbx-components/commit/7f45125d709fc3eb3b2f60ca98a444770923a960))
- lint fix ([9526d6a3](https://github.com/dereekb/dbx-components/commit/9526d6a3bc7ba7938d3b03bfba86ec5d365c128b))
- lint fix ([d44439a0](https://github.com/dereekb/dbx-components/commit/d44439a09f38f42e0f1974805e74b19624ebae5c))
- lint fix ([63553265](https://github.com/dereekb/dbx-components/commit/6355326590532eb72d100c829815e16305833c10))
- lint fix ([32acdcf3](https://github.com/dereekb/dbx-components/commit/32acdcf3c9d432b7f5ffbc37cffe30e5972f856a))
- lint fix ([00d06be2](https://github.com/dereekb/dbx-components/commit/00d06be2389350deee9e6ac923f80184ea4816d3))
- lint fix ([a3f1542b](https://github.com/dereekb/dbx-components/commit/a3f1542bcec9b91b8ba5af67db29df8ccd93f1de))
- lint fix ([50004bc8](https://github.com/dereekb/dbx-components/commit/50004bc8ba0a8e8c9a89aecde2b7c2580283faaa))
- lint fix ([f3b65488](https://github.com/dereekb/dbx-components/commit/f3b654888335be6268218f4d2649280d5910be9c))
- lint fix ([604cfb9d](https://github.com/dereekb/dbx-components/commit/604cfb9d799929b91f24e751a627c60467edfa85))
- lint fix ([c5a6c490](https://github.com/dereekb/dbx-components/commit/c5a6c490a18d8c0c931e3a70b0858963b2ce5c35))
- lint fix + mcp regeneration ([b731ffee](https://github.com/dereekb/dbx-components/commit/b731ffee570e5571fb130114bfc1845490367651))
- lint fix + mcp regeneration ([c676b46e](https://github.com/dereekb/dbx-components/commit/c676b46e3517470f68cdb11cf35d90dbce865b54))
- lint fix + mcp regeneration ([0ad6eec1](https://github.com/dereekb/dbx-components/commit/0ad6eec14dd945a718da976f70ea841e875dde29))
- lint fix + mcp regeneration ([128e22e0](https://github.com/dereekb/dbx-components/commit/128e22e0d3d617f03a4ecd5f22fd0583fd17b1d4))
- lint fix + mcp regeneration ([c49d3a28](https://github.com/dereekb/dbx-components/commit/c49d3a2808a2552d1e99e704959fcaa790a464d7))
- lint fix + mcp regeneration ([acb112fa](https://github.com/dereekb/dbx-components/commit/acb112fa7902aa3e7c0b94638519e3a5745da8c1))
- lint fix + mcp regeneration ([e413ee86](https://github.com/dereekb/dbx-components/commit/e413ee866c4ff79195e306502c3c4ce66bc18c4a))
- lint fix + mcp regeneration ([cd3bf0fb](https://github.com/dereekb/dbx-components/commit/cd3bf0fbbe9df7dc7ec014126daff7ad2103d3e6))
- lint fix with build type ([7441530e](https://github.com/dereekb/dbx-components/commit/7441530e31a4033940f389ac27809091f2223452))
- lint fixes ([cdd968de](https://github.com/dereekb/dbx-components/commit/cdd968de795ac557e99bae46b364ce523bdc68c7))
- lint fixes and test coverage for util ([5203111a](https://github.com/dereekb/dbx-components/commit/5203111aacc79691f0fdcd8229eacad3e2b34783))
- module build fix ([7dd34ee5](https://github.com/dereekb/dbx-components/commit/7dd34ee5e57c0905178b8aa85768a192abfeedcf))
- nx migrate ([19bc8c4a](https://github.com/dereekb/dbx-components/commit/19bc8c4a20935297d729292485b75bb5d1db2a91))
- peer dep sync + mcp regeneration ([e5ded0f7](https://github.com/dereekb/dbx-components/commit/e5ded0f7ab86565f6975a2f7faaf7096c581c73b))
- postcss-preset-env version bump ([094bd0c0](https://github.com/dereekb/dbx-components/commit/094bd0c0f38d3650d1dc1e6c78a4547c9d6cfff6))
- release CI requires test-setup-script to pass ([ec8c86cc](https://github.com/dereekb/dbx-components/commit/ec8c86ccf8d0fb84c40be77150d097f3ce9c4456))
- release patch ([979bfbda](https://github.com/dereekb/dbx-components/commit/979bfbdaa04e20785be4095d8c6d7ee181c05c6f))
- resolved all lint warnings in firebase-server ([1f83bc06](https://github.com/dereekb/dbx-components/commit/1f83bc0625795f57e200a95ecf1ae70329cd8324))
- resolved all lint warnings in nestjs, zoom, zoho ([48d47463](https://github.com/dereekb/dbx-components/commit/48d4746343db7ccb50af60de84e27d8421f269a5))
- resolved all lint warnings in util ([007c20c8](https://github.com/dereekb/dbx-components/commit/007c20c8446e5436d19b81c181be6d4cac1b63f6))
- revert node version to v16.18 ([eb2e1c35](https://github.com/dereekb/dbx-components/commit/eb2e1c3529b264d8e83ec10758b3a1c64b89cc61))
- reverted firebase-tools version ([3bff87c8](https://github.com/dereekb/dbx-components/commit/3bff87c87b4f8234295218090a284fa90dcbc30a))
- set max concurrency for jest tests ([5a0e78f4](https://github.com/dereekb/dbx-components/commit/5a0e78f45e3556782411ecb5c6f5d8afcb0f2fc6))
- set setup project firebase-tools version to 11.14.0 ([a3337dfd](https://github.com/dereekb/dbx-components/commit/a3337dfd08d1f036bdff13508e1be556c9451f3c))
- setup project ([a7f77557](https://github.com/dereekb/dbx-components/commit/a7f77557166b9d4d1bff658e0d5504ff61eb1539))
- setup project fixes ([a9d48852](https://github.com/dereekb/dbx-components/commit/a9d48852c48c4572162517c98a53ca6108ac8bd5))
- setup version fix ([0b358cfb](https://github.com/dereekb/dbx-components/commit/0b358cfb90e5388bf556f67659c8c588c7c3c50a))
- setup-project build fix ([bba8c048](https://github.com/dereekb/dbx-components/commit/bba8c048b7bacfbd0f9313ac3fd6a3c72334bf23))
- setup-project fix ([a1039329](https://github.com/dereekb/dbx-components/commit/a10393296201883de67968b1eb108e286270e996))
- setup-project.sh fix ([02b82cfd](https://github.com/dereekb/dbx-components/commit/02b82cfdf7115b5d4a621457b3a98cd771a00a4a))
- test fix ([56ad2205](https://github.com/dereekb/dbx-components/commit/56ad2205022cf06ff5de2fcb93fea9201c9cc188))
- update rrule to v2.7.0 ([#11](https://github.com/dereekb/dbx-components/issues/11)) ([6249fd73](https://github.com/dereekb/dbx-components/commit/6249fd7331130fec79d8ac1dcd66506907e8b076)), closes [#11](https://github.com/dereekb/dbx-components/issues/11)
- update setup-project.sh for v10 ([ee769e59](https://github.com/dereekb/dbx-components/commit/ee769e59e8c1c58214196d585fd467ff74d23fda))
- update start-release ([f5008138](https://github.com/dereekb/dbx-components/commit/f500813842de6e7664e4d2c7fb5219f1c7662562))
- updated build to node v18 ([7efb714d](https://github.com/dereekb/dbx-components/commit/7efb714d24ee243d6913eed557db587df6f186cd))
- updated circleci publishing ([12506412](https://github.com/dereekb/dbx-components/commit/125064124df0ddab146a4089e03af212e9d9d388))
- updated firebase dependencies ([2bf27dec](https://github.com/dereekb/dbx-components/commit/2bf27dec109dc19d43af7e2d5e1e40fe1492d4c3))
- updated firebase-functions version to ^3.22.0 ([d9eaf892](https://github.com/dereekb/dbx-components/commit/d9eaf8925cb2e891542d6169a8b0389aa65e90c4))
- updated firebase-tools to v11.3.0 ([60375860](https://github.com/dereekb/dbx-components/commit/603758608670858bdf738be37dd574587720bcbc))
- updated firebase-tools version ([bb480185](https://github.com/dereekb/dbx-components/commit/bb48018544e00fb6137221631e7ebbf7355a141b))
- updated input for all projects build-base configs ([68263663](https://github.com/dereekb/dbx-components/commit/682636637bced42970ca4e395c7934161aad8156))
- updated make-env.js ([1fe87a09](https://github.com/dereekb/dbx-components/commit/1fe87a096d1b86cc0dfacb393642a5e5a7d5e60a))
- updated nx to 14.x ([afed9cd5](https://github.com/dereekb/dbx-components/commit/afed9cd5c347c6f02939a8c99075072d5035c934))
- updated nx to v14.5.5 ([fd9eb02d](https://github.com/dereekb/dbx-components/commit/fd9eb02d5df7eb73a7d599952ad786fe6c46bee9))
- updated prettier config ([a4f91869](https://github.com/dereekb/dbx-components/commit/a4f918698e32f4a98975e9b40b82f08502b47ef5))
- updated release script to switch back to origin afterwards ([cfe663f3](https://github.com/dereekb/dbx-components/commit/cfe663f3ab5be008b6d9a2afbd6165ee7f537180))
- updated setup-project ([ca97f38e](https://github.com/dereekb/dbx-components/commit/ca97f38e04c88d5837e0a768cfe887f291519a9f))
- updated setup-project dependencies ([03766d25](https://github.com/dereekb/dbx-components/commit/03766d257f7f37e2574ec7943ab20ffb40223803))


### Checkpoints

- accordion view ([e25b39a4](https://github.com/dereekb/dbx-components/commit/e25b39a4f0115d9018e592f3c58d88afa33402b0))
- added DbxFirebaseModelEntitiesComponent ([501e8d2c](https://github.com/dereekb/dbx-components/commit/501e8d2c17abce7cda27665b6b75159a06296323))
- added DbxFirebaseModelEntitiesDebugWidgetComponent ([6a042be3](https://github.com/dereekb/dbx-components/commit/6a042be3eabb2f953043045047cc78d707744f7d))
- added demo-components ([71c6e5d9](https://github.com/dereekb/dbx-components/commit/71c6e5d964e6d12ceee1994231a30e4cacdd40a3))
- added eslint.config.mjs ([13525d5b](https://github.com/dereekb/dbx-components/commit/13525d5b5b20597523b0068c3077fdc142916ad5))
- added styling/assets to dbx-firebase ([39afbb99](https://github.com/dereekb/dbx-components/commit/39afbb99d5b38872bd0c461110e0cd538d24a0bf))
- added tests to driver ([cb183d5b](https://github.com/dereekb/dbx-components/commit/cb183d5b7900e12e44b2651d42bbe9020e5fdc62))
- added use of inject() ([2c573160](https://github.com/dereekb/dbx-components/commit/2c573160fbf00f7b033b5c0f5a278f636b5f26c6))
- added vapi.ai integration ([9e26684f](https://github.com/dereekb/dbx-components/commit/9e26684f2566e8a0033aa159c153f5e0e0bf31a3))
- auth ([bf00f702](https://github.com/dereekb/dbx-components/commit/bf00f7029e8d2820e406d1ab80348fb136e2eeb7))
- authRoleClaimsFactory ([308206de](https://github.com/dereekb/dbx-components/commit/308206de5f195c85cdd874de95a1ee9a9637e288))
- button echo overlay and icon fixes ([4f7c4f10](https://github.com/dereekb/dbx-components/commit/4f7c4f10f9995a69c029144f74fbca16a3df8956))
- claude skills for dbx-components ([231a4fd2](https://github.com/dereekb/dbx-components/commit/231a4fd23ca4c91ff0574d9091c7bc43621a55d3))
- collection loader test fix ([b857cec9](https://github.com/dereekb/dbx-components/commit/b857cec908fd79a728b8e5bbea5c7cc4e6118e5d))
- created @dereekb/nestjs ([74877798](https://github.com/dereekb/dbx-components/commit/74877798b6425d0d8594faf220ed57c53d653e24))
- dbx-form Angular 18 migrations ([c5030fa3](https://github.com/dereekb/dbx-components/commit/c5030fa3a5507bd361c3c917e1a4b4c293934f05))
- dbxTwoColumns demo ([ba0b39c7](https://github.com/dereekb/dbx-components/commit/ba0b39c76c4fb57b6ff729f278cc23d21e84fbab))
- demo ([c5bfe24d](https://github.com/dereekb/dbx-components/commit/c5bfe24d3a906e4f72c7f6fef5d99015d7d5bb56))
- demo ([221af8ea](https://github.com/dereekb/dbx-components/commit/221af8ea73bfa3ba22a7e86a0f6d707cb75e08d2))
- demo ([15ff18b0](https://github.com/dereekb/dbx-components/commit/15ff18b0a0934b2b07a46669bd7c32a3f8ad4764))
- demo ([e857c31e](https://github.com/dereekb/dbx-components/commit/e857c31e9d61f5b3e21beede773f148b6dc8e527))
- demo ([765f4b3f](https://github.com/dereekb/dbx-components/commit/765f4b3f30e05ac3d78bd497e701c5e0a0137fcb))
- demo ([b0f87e0c](https://github.com/dereekb/dbx-components/commit/b0f87e0cf74992a577b74808a9c87993b9405917))
- demo app model structure and services ([08956814](https://github.com/dereekb/dbx-components/commit/0895681476f1423e454c9be7d138d03dd37e7841))
- demo app model structure and services ([53628ac5](https://github.com/dereekb/dbx-components/commit/53628ac502ea70868060b8f7146bc4f0035df636))
- demo app model structure and services ([590f8efa](https://github.com/dereekb/dbx-components/commit/590f8efabe23a7c2d11239af6163f546cf8077e1))
- demo app model structure and services ([d137b1ed](https://github.com/dereekb/dbx-components/commit/d137b1ed491bfa36ccb17798e314c15fbdededc5))
- demo app model structure and services ([06ae4ff4](https://github.com/dereekb/dbx-components/commit/06ae4ff411fea828716b7700dedd08652af2ec69))
- demo app model structure and services ([6a7849b1](https://github.com/dereekb/dbx-components/commit/6a7849b1bc6cb0a51112d4579ebbca029d437299))
- demo app model structure and services ([dd1246a2](https://github.com/dereekb/dbx-components/commit/dd1246a26c94b018d856ae41640c1550ec9d5430))
- demo app model structure and services ([d6b60678](https://github.com/dereekb/dbx-components/commit/d6b6067850742886e3669872c05882bbbbb6e1df))
- demo login ([fe572b22](https://github.com/dereekb/dbx-components/commit/fe572b227e2acef45b048293a6d4f311e60c233c))
- demo login ([5a658d68](https://github.com/dereekb/dbx-components/commit/5a658d68822d656c2ea13304e187b723ad46b6fb))
- demo login ([50a6de8d](https://github.com/dereekb/dbx-components/commit/50a6de8d9049b75ba1382c8a354a51e9ca6702a5))
- demo login ([02bc4a3a](https://github.com/dereekb/dbx-components/commit/02bc4a3abd88e1a23b895463cf5e05ebeee75d82))
- demo login ([2d75cd3d](https://github.com/dereekb/dbx-components/commit/2d75cd3d6231bbbe2758dac70cfa71e2382a2d15))
- demo login ([780901df](https://github.com/dereekb/dbx-components/commit/780901df0f4fbfa6acc94a2de14abb1b93d6dc32))
- demo login ([075db0d1](https://github.com/dereekb/dbx-components/commit/075db0d1c1850e99ab2772e6befde57077b49af7))
- demo login ([8695ac34](https://github.com/dereekb/dbx-components/commit/8695ac34f71af78a311ce477e40d6ea03b24dfc4))
- firebase client ([1b2dcaee](https://github.com/dereekb/dbx-components/commit/1b2dcaee9074d57a1b30bb3764c9ff5ecdd43c57))
- firebase common ([b5b71652](https://github.com/dereekb/dbx-components/commit/b5b716529659a34d90dc047872d3eb3c74e95460))
- firebase common ([038b48c6](https://github.com/dereekb/dbx-components/commit/038b48c6c6c91d8dff4ece803d04df650d9e1d23))
- firebaseModelsService utilities ([f5a3f7e8](https://github.com/dereekb/dbx-components/commit/f5a3f7e8deadef942c6e0340715cdd1550cc4be2))
- firestore collection cache ([f00f9a0d](https://github.com/dereekb/dbx-components/commit/f00f9a0d96e425f5fc9c5a48d031c7a4912bab61))
- firestore subcollection support ([9de3d976](https://github.com/dereekb/dbx-components/commit/9de3d976767cdec9f362f6054349443049449bc1))
- fixes ([f3c08160](https://github.com/dereekb/dbx-components/commit/f3c08160ab7101535b3e5ba691320f0b3e994cbf))
- formatting ([bf7f7cb8](https://github.com/dereekb/dbx-components/commit/bf7f7cb89e603e7199e9da83714bf50f96f59c5e))
- group items in list ([d5a620c3](https://github.com/dereekb/dbx-components/commit/d5a620c33a45cb6197b65917d6542cb95ced30f2))
- guestbook demo ([51c75301](https://github.com/dereekb/dbx-components/commit/51c75301b3f11410fe8f5771742449077b279b88))
- guestbook demo ([ceb7f077](https://github.com/dereekb/dbx-components/commit/ceb7f07789ebf0895a1e415ded39eac09bbfc578))
- lint fixes ([60bd3593](https://github.com/dereekb/dbx-components/commit/60bd359391c63827618b281ffae3eb339c3a0152))
- notification tasks ([bd55cc40](https://github.com/dereekb/dbx-components/commit/bd55cc40b3efcd26ae57791d717c4dc2133727ee))
- outlined dbx-web/calendar ([bf283c6d](https://github.com/dereekb/dbx-components/commit/bf283c6deaae647c0816518587211cd9b7e65334))
- outlined DbxCalendarScheduleSelectionComponent ([3e4b9d60](https://github.com/dereekb/dbx-components/commit/3e4b9d60de01e610d1deeb5ebe2b114d69d6b568))
- output fix for DbxCalendarScheduleSelectionStore ([1b9f014a](https://github.com/dereekb/dbx-components/commit/1b9f014aa3817246976ccaabf11bbf40573f2f1b))
- project standalone update cleanup ([5e8374c6](https://github.com/dereekb/dbx-components/commit/5e8374c659a505f8e9e2c649f08e1ade7f826ea6))
- project standalone update cleanup ([12485863](https://github.com/dereekb/dbx-components/commit/124858636f45039bd3dd0bbaf3eb1ad3099373f0))
- project standalone update cleanup ([4e71eb53](https://github.com/dereekb/dbx-components/commit/4e71eb53ebeb1bea66743ab7183a2713e8186fd4))
- project standalone update cleanup ([97feee72](https://github.com/dereekb/dbx-components/commit/97feee72d97c21b2c7f3a266ced6faa308274a48))
- project standalone update cleanup ([f9f44b5b](https://github.com/dereekb/dbx-components/commit/f9f44b5b3246caa8ee9e40f5f2fbb03954135cd6))
- project standalone update part 1 ([679c887a](https://github.com/dereekb/dbx-components/commit/679c887a524ef089010e6daeca7128a2df8c8240))
- project standalone update part 2 ([f24d7777](https://github.com/dereekb/dbx-components/commit/f24d77770f1b16de45bcdde457b440ce8202b5e9))
- refactored firestore files/classes ([becdbdf6](https://github.com/dereekb/dbx-components/commit/becdbdf6400f5b7bbb2f6a5cce081c16fe59ebc2))
- removed unused entity-metadata.ts ([52a1ec8a](https://github.com/dereekb/dbx-components/commit/52a1ec8a03c53bae8368639055571efbed8e9ecd))
- replace useDefineForClassFields ([3fb78d47](https://github.com/dereekb/dbx-components/commit/3fb78d472e95412dc3e55b458115a654ca643500))
- replace useDefineForClassFields ([4940394a](https://github.com/dereekb/dbx-components/commit/4940394a7be52e7ad0e6b7d510bf857d2072befb))
- replace useDefineForClassFields ([fa63bd79](https://github.com/dereekb/dbx-components/commit/fa63bd79a4272e7314e64d7df7f3d92737cf9feb))
- setup project ([43a6e5da](https://github.com/dereekb/dbx-components/commit/43a6e5daac84b07749476c7ac35c912798b18b43))
- setup project ([b25f6b99](https://github.com/dereekb/dbx-components/commit/b25f6b994c3f0dd4f7d4f90d453942066e1b411c))
- setup project ([d48a0e42](https://github.com/dereekb/dbx-components/commit/d48a0e4294c532a7ff9616794847bcf844af161e))
- setup project ([0df8dfbd](https://github.com/dereekb/dbx-components/commit/0df8dfbd84f0ac9a8dcc9b345668bee79d9f7469))
- setup-project.sh updates ([82553340](https://github.com/dereekb/dbx-components/commit/825533407a8a830e3b1ff653b0626ff8ea7f52b7))
- setup-project.sh updates ([5f97768b](https://github.com/dereekb/dbx-components/commit/5f97768bb0385549e3f37e0ddb485d96d9bc8804))
- setup-project.sh updates ([d40b15f7](https://github.com/dereekb/dbx-components/commit/d40b15f741c32e47c9eb19ca500a466e79943eb9))
- sync ([f60af392](https://github.com/dereekb/dbx-components/commit/f60af392bc8d0820538c3134344d567135022907))
- sync ([8123dead](https://github.com/dereekb/dbx-components/commit/8123dead9d4e6a610a8369af49e34da67ea8f369))
- sync ([ccd5651a](https://github.com/dereekb/dbx-components/commit/ccd5651a48c2865af37a1fd9e3c5c8cbc65f20c9))
- test fix ([abac6aa3](https://github.com/dereekb/dbx-components/commit/abac6aa35bf3dffd589c88decda3cc8068e5d24b))
- test fix ([c6427bc8](https://github.com/dereekb/dbx-components/commit/c6427bc89179c81ce0fbcbd6dabb5ee35bcc5605))
- test fixes ([f9170e38](https://github.com/dereekb/dbx-components/commit/f9170e384aa04e7d6144c6c49d45566106d45bac))
- test fixes ([cab0411c](https://github.com/dereekb/dbx-components/commit/cab0411c643f21117597a05b5032697e5437b5d5))
- test fixes for test projects ([024cb62e](https://github.com/dereekb/dbx-components/commit/024cb62ef584755f19d1b951b4f69ead0b2872fb))
- update setup-project.sh ([07cffe55](https://github.com/dereekb/dbx-components/commit/07cffe55a4a7cbd0648ee400471a239d5b39ef40))
- utils tests ([2d522bac](https://github.com/dereekb/dbx-components/commit/2d522bac24b14b74ce4fa345d267203043c05900))
- utils tests ([b34a1938](https://github.com/dereekb/dbx-components/commit/b34a1938973237d89075d568dca0d3138201119b))
- utils tests ([af9bdf63](https://github.com/dereekb/dbx-components/commit/af9bdf63696758ef75fd9f778c9ca47cc8fd8508))
- wiki files ([6cd465cd](https://github.com/dereekb/dbx-components/commit/6cd465cd6959aed4c56bd60d54c0afc9ba8c4963))
- yearMonthDayCode ([03f07299](https://github.com/dereekb/dbx-components/commit/03f0729927f4088acca4fe4321e96de9896e1d3b))
- zoom webhook controller ([58c6474b](https://github.com/dereekb/dbx-components/commit/58c6474b5e625da0fc4a3d841d8a97c02974ceac))
- zoom webhook controller ([aeabb089](https://github.com/dereekb/dbx-components/commit/aeabb0895ad94895614f3a84f8f3835b5be66e70))
- zoom webhook controller ([1e4d1856](https://github.com/dereekb/dbx-components/commit/1e4d18568ac2d36f48036042ead2a42878e445bc))


### Code Refactoring

-  nx.json update ([f8357192](https://github.com/dereekb/dbx-components/commit/f835719266d463d0ff6e90cafee904f51e32de2b))
- @__NO_SIDE_EFFECTS__ on overloaded factory impls ([9ae015f2](https://github.com/dereekb/dbx-components/commit/9ae015f2e000d461df87dec609405ef35560d191))
- @dereekb/browser eslint improvements ([ef752ac9](https://github.com/dereekb/dbx-components/commit/ef752ac9e44c6c1705c874e2c20430c8321391eb))
- @dereekb/date convention fixes ([4dfa7632](https://github.com/dereekb/dbx-components/commit/4dfa76324678a7d5b7d80293e6ed5316e8a19b4b))
- @dereekb/date eslint improvements ([8cf9455d](https://github.com/dereekb/dbx-components/commit/8cf9455decf71ae0294ea148eb73c171d18228a3))
- @dereekb/dbx-core eslint improvements ([2d86cd37](https://github.com/dereekb/dbx-components/commit/2d86cd37800a8e629d673343f6ce47bb3db814d3))
- @dereekb/dbx-firebase eslint improvements ([13632612](https://github.com/dereekb/dbx-components/commit/1363261252f3b06f24c26a3e7229589e486fc4b0))
- @dereekb/dbx-form eslint improvements ([3ca3d68a](https://github.com/dereekb/dbx-components/commit/3ca3d68a2164f32f5f84b5a3234218928f07e1bf))
- @dereekb/dbx-web eslint improvements ([42a34726](https://github.com/dereekb/dbx-components/commit/42a34726768fd1eaf859ecf2f634fc11baf61a21))
- @dereekb/firebase es-lint improvements ([07782e5f](https://github.com/dereekb/dbx-components/commit/07782e5ff8a1e1f0345eab3cc7416d7349a7fbdd))
- @dereekb/firebase-server eslint improvements ([adec48ac](https://github.com/dereekb/dbx-components/commit/adec48ac3162c648adabfdd140ce3d2434ff1076))
- @dereekb/nest, firebase, model eslint improvements ([6141baf7](https://github.com/dereekb/dbx-components/commit/6141baf747bb7d7ce63dc004a06f8174aa1d35ed))
- @dereekb/rxjs eslint improvements ([998502be](https://github.com/dereekb/dbx-components/commit/998502be639458e25b9da42b6febb64b8324a35a))
- @dereekb/util eslint improvements ([531eee47](https://github.com/dereekb/dbx-components/commit/531eee47ffdb2eb94957f6bf983baab3cb4a4f04))
- @dereekb/util esm export fix ([1c8e2313](https://github.com/dereekb/dbx-components/commit/1c8e2313c608bc3971afdc5d6e670ea864f63788))
- add ARIA accessibility to all forge field components ([5ccc72b9](https://github.com/dereekb/dbx-components/commit/5ccc72b923b114b5a17c523bb952056393f1d011))
- add forge value-selection field and action dialog ([2ce9048c](https://github.com/dereekb/dbx-components/commit/2ce9048c5ba62382f2b6ad56227843b88dea494b))
- add logic support to all forge field configs ([ec888712](https://github.com/dereekb/dbx-components/commit/ec8887123d60a2100e0c7deeb9559ca7c50d801e))
- added 'array-contains-any' to WhereFilterOp ([2d1b67a1](https://github.com/dereekb/dbx-components/commit/2d1b67a12f12d4f02e70ad6e6044a271b19c0082))
- added 'empty' option to ExpandUniqueDateCellsFillOption ([1767d1d4](https://github.com/dereekb/dbx-components/commit/1767d1d467a78c241b6d820263b1eeb933701344))
- added 'normal' mode to fixedDateRangeField ([7045287b](https://github.com/dereekb/dbx-components/commit/7045287b7f3d114ab8774c7608c98125da0196cb))
- added @__NO_SIDE_EFFECTS__ to factories ([857ee869](https://github.com/dereekb/dbx-components/commit/857ee869782d59402b6998ce9cab5ff4a9f86448))
- added @dereekb/dbx-form/quiz entry point ([d7a4ce7b](https://github.com/dereekb/dbx-components/commit/d7a4ce7b4cb55635e75904f616ff5b51c4ff60e1))
- added @dereekb/dbx-web/eslint plugin ([3db6d2a8](https://github.com/dereekb/dbx-components/commit/3db6d2a831d4c27de66357379c1a93cd71b96547))
- added @dereekb/firebase-server/zoho ([bedb9ba2](https://github.com/dereekb/dbx-components/commit/bedb9ba2d96e5aacba23eaddaadc717bade57664))
- added @dereekb/nestjs/eslint sub-entry ([0ed211b0](https://github.com/dereekb/dbx-components/commit/0ed211b07a9ba61d0f758e186c0beb0e5021ffe0))
- added AbstractRootSingleItemDbxFirebaseDocument ([769dc9ff](https://github.com/dereekb/dbx-components/commit/769dc9ff2f1b570a5416783851eab5db57489a06))
- added AbstractSingleItemDbxFirebaseDocument ([b793f26c](https://github.com/dereekb/dbx-components/commit/b793f26c302630cda99f3d4f3ab28d2c80c88161))
- added addContactInfo to AuthorizedUserTestContext template ([03d06eda](https://github.com/dereekb/dbx-components/commit/03d06eda6f84a5d40f817431824553c9c944e4b4))
- added additional constants ([67d1583a](https://github.com/dereekb/dbx-components/commit/67d1583a765bacbfc16d046aaed33712ebb951f7))
- added addNewUserSetupClaims() to FirebaseServerNewUserService ([6dcb521d](https://github.com/dereekb/dbx-components/commit/6dcb521da604dda22e92c38fd48b95b6b3c9c7ed))
- added addTemplate() to repeatArrayField() ([e80341a1](https://github.com/dereekb/dbx-components/commit/e80341a1b737471f72159dbc7dcbd1dc216a92c9))
- added AllCommaSeparatedKeys ([c3069825](https://github.com/dereekb/dbx-components/commit/c3069825dd62ca08dc2942c299284953ec2f0b33))
- added allIndexesInDateBlockRanges() ([15ac2786](https://github.com/dereekb/dbx-components/commit/15ac2786dde76401854a7381706c6ccca10f1f70))
- added allIndexesInDateCellRangesToArray() ([cabceaf1](https://github.com/dereekb/dbx-components/commit/cabceaf1296e3cde9853b828daa3de51eda47cf4))
- added allowedModes input to DbxSidenavComponent ([82ea8443](https://github.com/dereekb/dbx-components/commit/82ea84436808fb127c10cfe50068ea493a5395ee))
- added alwaysShowDateInput option to dateTimeField() ([135938bb](https://github.com/dereekb/dbx-components/commit/135938bbec472338bad13b2cb1736e5e3b1d54bc))
- added applySplitStringTreeWithMultipleValues() ([4024a5a1](https://github.com/dereekb/dbx-components/commit/4024a5a1a2fde5be82c6cf49327b41e87726f49d))
- added appZohoRecruitModuleMetadata() ([ed7ac1e7](https://github.com/dereekb/dbx-components/commit/ed7ac1e7f2bbcc33c5e4970ad20ebed2dde48f1e))
- added ARKTYPE_DATE_DTO_TYPE for Date | string.date.parse ([36350f75](https://github.com/dereekb/dbx-components/commit/36350f7517d8211140605fde24b0faa6bee803e9))
- added arrayDecisionFunction() ([4503969f](https://github.com/dereekb/dbx-components/commit/4503969f1fd29f382a786bd1acef6433e5898e5a))
- added arrayUpdate to FirestoreDocument ([14183355](https://github.com/dereekb/dbx-components/commit/141833552f33d574db59f6d9addac5bbf4217655))
- added arrow keys to dateTimeField date field ([924f3d9d](https://github.com/dereekb/dbx-components/commit/924f3d9dc91766bc01972282c213f06525110d82))
- added assertExists() to ContextGrantedModelRolesReaderInstance ([b3d243cf](https://github.com/dereekb/dbx-components/commit/b3d243cfba0bd0b57e79bfd01419c24458b212b4))
- added assertSnapshotDataWithKey() ([e953742f](https://github.com/dereekb/dbx-components/commit/e953742fc27ce213fd887efd22a346bd73b6be3d))
- added associateCandidateRecordsWithJobOpenings() ([31d240bf](https://github.com/dereekb/dbx-components/commit/31d240bf3253416fe8ceb7b907e4d1331f8f8c81))
- added auth/wrong-password code handling ([a0877d02](https://github.com/dereekb/dbx-components/commit/a0877d0253b87449b3b8dde8514b02afb5a6209e))
- added batch StorageFile download API ([bbcaef10](https://github.com/dereekb/dbx-components/commit/bbcaef10c37c931de21bc8dd983ef1d15e2520d9))
- added bitwiseObjectDencoder() ([81c17a6d](https://github.com/dereekb/dbx-components/commit/81c17a6db1ffe2ddb734ac10c75c7c95dd4451d8))
- added bufferHasValidPdfMarkings() ([ac98fe91](https://github.com/dereekb/dbx-components/commit/ac98fe91307d712e261800f21395b34fa2d505fa))
- added build assets to zoho-nestjs project config ([b79fb1da](https://github.com/dereekb/dbx-components/commit/b79fb1da49bf4f31e2d66c64eb012f3505360d80))
- added buttonDisplay input to dbx-filter-popover-button ([b6684948](https://github.com/dereekb/dbx-components/commit/b6684948456f2a49900ade35a0f014b1f1bbb954))
- added canQueueStorageFileForProcessing() ([f4b3da1f](https://github.com/dereekb/dbx-components/commit/f4b3da1f3be49c5cd9f6a8866d9466883c020a9a))
- added cellContentFactory to dateScheduleRangeField() ([7fd4cda3](https://github.com/dereekb/dbx-components/commit/7fd4cda34c1915caba8ef9553b012522ac62b7ba))
- added centerGivenMargin$ ([40903e42](https://github.com/dereekb/dbx-components/commit/40903e423848ad663250700ac50a4449f3efd77b))
- added changeTimingToTimezoneFunction() ([c5025e20](https://github.com/dereekb/dbx-components/commit/c5025e2086bfebeb3ba3e2e15f17a9d4aaf22157))
- added childFirestoreModelKeys() ([e067b3f0](https://github.com/dereekb/dbx-components/commit/e067b3f02951c725229aabf42e2edb6b2e83a59a))
- added clampDateRange() ([81654c3a](https://github.com/dereekb/dbx-components/commit/81654c3ae155df78ec36fe61fc188f1b85994dbe))
- added clean() and derivatives ([90822348](https://github.com/dereekb/dbx-components/commit/908223486dfb1dc7d35e34a80145c412b7d250bf))
- added clearable() to optional arktype fields ([ec5f46a6](https://github.com/dereekb/dbx-components/commit/ec5f46a646b07df15a7cb2f98e5b534772c2ab16))
- added clientUrl to mailgun config ([5b47ecdc](https://github.com/dereekb/dbx-components/commit/5b47ecdc2e64ac5b47aee60d620c10f72d78be7e))
- added close button to dbx-filter-popover-button ([bcffd736](https://github.com/dereekb/dbx-components/commit/bcffd73633b2c7fad37c03caab714c2676903e7b))
- added combineLoadingStatesStatus ([203805d0](https://github.com/dereekb/dbx-components/commit/203805d0b25e87e0db545e1ebb2ba897a0362681))
- added computeNextFreeIndexFunction() ([8f583d0b](https://github.com/dereekb/dbx-components/commit/8f583d0baebe83b561cc96ca58b96493352ffb3a))
- added config input to DbxStepBlockComponent ([1cf91678](https://github.com/dereekb/dbx-components/commit/1cf91678b157b7990fae63fbff71d32d18c714f0))
- added configurable drawerWidth to DbxMapboxConfig ([554599b9](https://github.com/dereekb/dbx-components/commit/554599b996eef587f683a36e1dc7cd12a9174e3f))
- added contact generation to AuthorizedUserTestContextFactory ([778c4fd6](https://github.com/dereekb/dbx-components/commit/778c4fd61fec5ac332f1503c06df9be8cffc98c7))
- added context to model tracker events ([3bb59f9c](https://github.com/dereekb/dbx-components/commit/3bb59f9cec86dca88b6327430355fc9a359da92d))
- added context7 ([93907496](https://github.com/dereekb/dbx-components/commit/93907496a3376ca92c41ae2866f43f569524e4ec))
- added Count semantic number type ([4869d676](https://github.com/dereekb/dbx-components/commit/4869d676711446989f95c0bda7d9de5d24f39df4))
- added countDocs() to FirestoreExecutableQuery ([fad208f3](https://github.com/dereekb/dbx-components/commit/fad208f3a3c0f9ee91532aed38622a2e2c83bcfb))
- added create, update to FirestoreDocument ([460f864c](https://github.com/dereekb/dbx-components/commit/460f864c2e977b91f93e27d6dbd3eb6f4a868cfe))
- added createOrRunUniqueNotificationDocument() ([9dc5487a](https://github.com/dereekb/dbx-components/commit/9dc5487af60c7ade192d0fedb97bcdb81b3d8694))
- added creationTime to AuthUserInfo ([f3a5c6e8](https://github.com/dereekb/dbx-components/commit/f3a5c6e8088f27ad1098cea714213bc3e7638277))
- added creationTime, lastSignInTime to authDetailsForRecord ([2249ea6e](https://github.com/dereekb/dbx-components/commit/2249ea6e20f78409aa30406bbb583e56ce4fbe49))
- added cross-platform AssetLoader utility ([2acd4d09](https://github.com/dereekb/dbx-components/commit/2acd4d09369971b76bb204a37218f48cf94e189f))
- added currentCheckpointSendAttempts ([ab87c886](https://github.com/dereekb/dbx-components/commit/ab87c886c817017eddfc1603be4c7a08075d01af))
- added custom icon to dbx-navbar ([3d348df6](https://github.com/dereekb/dbx-components/commit/3d348df62eb0df52cfbd80946ce27ce6e3e4583b))
- added customization to DbxScheduleSelectionCalendarComponent ([5243e386](https://github.com/dereekb/dbx-components/commit/5243e386e07a53057fefd779842658a8470fcdb9))
- added data to FirebaseServerAuthNewUserSetupDetails ([a836f938](https://github.com/dereekb/dbx-components/commit/a836f938deb58aeb58903b9c794b667a81e48ac7))
- added date-schedule-selection-timezone css class ([b6932ce4](https://github.com/dereekb/dbx-components/commit/b6932ce43813c76225ef29d8237394542b39f245))
- added DateBlockIndexRange ([0aa9f673](https://github.com/dereekb/dbx-components/commit/0aa9f673ebf47bdbdc44cdefc6ec759f60f9dcce))
- added dateBlockIndexsForDateScheduleDayCodes() ([53dc2603](https://github.com/dereekb/dbx-components/commit/53dc26030902bbe8dfcc7f4c475a594d959fac50))
- added dateBlockIndexYearWeekCodeGroupFactory() ([f0e3fa8f](https://github.com/dereekb/dbx-components/commit/f0e3fa8f72de58b22f96035f9f91c9b96aef2d3c))
- added DateBlockIsWithinDateBlockRangeFunction ([a51ac448](https://github.com/dereekb/dbx-components/commit/a51ac448495068eacb59e2b1536b181a3f410be3))
- added dateBlockRangeOverlapsRangeFunction() ([81f03d7a](https://github.com/dereekb/dbx-components/commit/81f03d7a8f945af4bec85a7b676dcc1bc411eeb4))
- added dateBlockTimingFromDateRangeAndEvent() ([57f08e95](https://github.com/dereekb/dbx-components/commit/57f08e95cc19f2ec52da4ebd1a0c7d43a79f17f6))
- added dateBlockTimingFullRange(), dateBlockTimingEventRange() ([7e1d0ea5](https://github.com/dereekb/dbx-components/commit/7e1d0ea54776b8bab11f9eed6b41206d5071c1ac))
- added dateBlockTimingInTimezoneFunction() ([0fb4845e](https://github.com/dereekb/dbx-components/commit/0fb4845e7696a89c2d6c34b8b1dd981570e12f56))
- added dateCellRangeOfTiming() ([e15d5678](https://github.com/dereekb/dbx-components/commit/e15d56785454994e89a7bb8e7a654e9acb2f4a38))
- added dateCellTimingCompletedTimeRange() ([fc0f03c4](https://github.com/dereekb/dbx-components/commit/fc0f03c4eb4b1808e51f3a64e745ec304b230964))
- added dateCellTimingLatestCompletedIndex() ([243e2d65](https://github.com/dereekb/dbx-components/commit/243e2d65e6d56502311cb0e373adc8d1ba2d0290))
- added dateDateRange ([96d5e354](https://github.com/dereekb/dbx-components/commit/96d5e354d3b17f01dde8c3b9a1cba437ef36341d))
- added dateInterval() ([ea2f8a73](https://github.com/dereekb/dbx-components/commit/ea2f8a73008af0715344c6c5977b30de4637d277))
- added DateOrDayStringRange ([12532add](https://github.com/dereekb/dbx-components/commit/12532add91acf0bd093cef125b386c14818d18a2))
- added dateRangeField() ([7c34c7da](https://github.com/dereekb/dbx-components/commit/7c34c7da6b8e5dbdf276b7a1ebcf7b8e5286d11c))
- added dateScheduleRangeField() close button customization ([e943e94f](https://github.com/dereekb/dbx-components/commit/e943e94f7e40cefff88912392831cda91f5341a0))
- added dateTimeField() timeDate config option ([1b95436c](https://github.com/dereekb/dbx-components/commit/1b95436c087b766cfeb85af9de13ee4352981eee))
- added DateTimePresets config to dateTimeField() ([39ae0b00](https://github.com/dereekb/dbx-components/commit/39ae0b00803922a9ac2d4206edf366032ef0dc56))
- added dateTimeRange(), dateDayTimeRange() pipe ([400ae71d](https://github.com/dereekb/dbx-components/commit/400ae71dca221b38e15b67809b67d389b89d2f9d))
- added dateTimeRangeField() ([d1733ce5](https://github.com/dereekb/dbx-components/commit/d1733ce550e10bd581c5dd2b3080d3a4b4f7b9e2))
- added DateTimeRangeOnlyDistancePipe ([c21581b3](https://github.com/dereekb/dbx-components/commit/c21581b36fb6feb386d4a5a724926360639663ae))
- added DateTimeRangeOnlyPipe ([76bccc63](https://github.com/dereekb/dbx-components/commit/76bccc63aa0b7f2204b9dacd3edb7673338faed6))
- added dbx color support to dbx-icon-button ([a1abda09](https://github.com/dereekb/dbx-components/commit/a1abda09d760b7bb4c133f22eee6a4ab2b6df033))
- added dbx padding/margin styling classes ([dccb0874](https://github.com/dereekb/dbx-components/commit/dccb0874b17662e685848ae7f06a037336dd82a5))
- added DBX_ONBOARD_APP_CONTEXT_STATE ([1ef2077e](https://github.com/dereekb/dbx-components/commit/1ef2077e00ea7d1a2763901c7ad1fb11eed00b77))
- added dbx-asset mcp tools ([dd0e199d](https://github.com/dereekb/dbx-components/commit/dd0e199dc924eb0c506134d85558726f0b5163ab))
- added dbx-button-column css ([dc4cb9be](https://github.com/dereekb/dbx-components/commit/dc4cb9bea9c195639ca0071d39432e24c8e191e4))
- added dbx-chip presentation to DbxMapboxMarker ([5a13262b](https://github.com/dereekb/dbx-components/commit/5a13262bbedd1b2cd34a9f2f60cd5a4216199034))
- added dbx-detail-block ([f43f13c5](https://github.com/dereekb/dbx-components/commit/f43f13c5925ff0f72f66dca0852dde9d5d7393b6))
- added dbx-download-text-view ([0558428e](https://github.com/dereekb/dbx-components/commit/0558428e266fb7f0188484b6d1950c136a5ef8b2))
- added dbx-firebase-oidc-grant-list-container ([0723879c](https://github.com/dereekb/dbx-components/commit/0723879cb6d0367b40242586b832e90d161f19ef))
- added dbx-icon-button ([86f51fce](https://github.com/dereekb/dbx-components/commit/86f51fce4f82688bd1d4ac60c20616125595e866))
- added dbx-icon-tile component and directive ([0fe5845d](https://github.com/dereekb/dbx-components/commit/0fe5845db2cf434a9bd6abe8373467330e121f82))
- added dbx-iframe ([6e256fba](https://github.com/dereekb/dbx-components/commit/6e256fbacd9ba292445f5422c0b5f3b0ef7d746e))
- added dbx-list css helper classes ([ecc0d01a](https://github.com/dereekb/dbx-components/commit/ecc0d01a9281b55b8897d5023346d2d1966f7804))
- added dbx-mapbox-injection ([925b9f31](https://github.com/dereekb/dbx-components/commit/925b9f3155f3fbe46af1f6937c66670cd804b579))
- added dbx-partial-preset-filter-menu ([a4215a31](https://github.com/dereekb/dbx-components/commit/a4215a31b78411f91eb1e7c6f7e75c6962703ae9))
- added dbx-preset-partial-filter-list ([1c8939b9](https://github.com/dereekb/dbx-components/commit/1c8939b9736af0bc0d90f48ec04c5e60e8a338d4))
- added dbx-schedule-selection-calendar-compact ([373e3a57](https://github.com/dereekb/dbx-components/commit/373e3a576c2a23d9db2b77ac44bd4b81d17f80de))
- added dbx-section-header-padded option ([d4cd1f5f](https://github.com/dereekb/dbx-components/commit/d4cd1f5f653d2587d76c168990590d82814b6384))
- added dbx-table group header resizing ([2cc0148a](https://github.com/dereekb/dbx-components/commit/2cc0148ab788854f215f2bcc60844cb5f6a73ca0))
- added dbx-us-address ([2edf14d7](https://github.com/dereekb/dbx-components/commit/2edf14d7f205bea85f7df22594a769c896051c26))
- added dbx-web display style names ([8ebec67f](https://github.com/dereekb/dbx-components/commit/8ebec67f80733e2a6c3df653aab5d6a2633223e8))
- added dbxActionHandlerValue ([45e445fe](https://github.com/dereekb/dbx-components/commit/45e445fe304f1dc2a8877c5a452d0065d97dcf7e))
- added DbxActionIdleDirective and related directives ([bc947821](https://github.com/dereekb/dbx-components/commit/bc94782173f139fb82646fa25c99a6ab1a676cea))
- added DbxAppEnvironmentService ([d01b35fd](https://github.com/dereekb/dbx-components/commit/d01b35fdfc107967a03ed78d41a1fd885a125a4c))
- added dbxBody, dbxStructure ([7351c44c](https://github.com/dereekb/dbx-components/commit/7351c44cb5613399d222c5b8ae394c3d7531be31))
- added DbxCalendarScheduleSelectionStoreSelectionMode ([807fe625](https://github.com/dereekb/dbx-components/commit/807fe625cac4bb5b3b5b29a15ad42a8d67fa1830))
- added DbxChipListComponent, tonal color system ([da097523](https://github.com/dereekb/dbx-components/commit/da097523ae52746dbbfe2af599fadd9b19e6e844))
- added DbxClickToCopyTextDirective ([07cb7cb4](https://github.com/dereekb/dbx-components/commit/07cb7cb4ee429aaaf8f34a127f7aaafe54dbecbd))
- added DbxDateTimeValueMode ([47b55d42](https://github.com/dereekb/dbx-components/commit/47b55d42828e26b70d615a5e47ff91f62fd072da))
- added DbxFirebaseCollectionChangeTrigger ([b566be42](https://github.com/dereekb/dbx-components/commit/b566be42791ee9c3522f8fc55e214c7bf9b44e03))
- added dbxFirebaseCollectionChangeTriggerForStore() default fn ([8763f2a3](https://github.com/dereekb/dbx-components/commit/8763f2a38e0c14546f0285edd91f0e9cc7b275b6))
- added DbxFirebaseDocumentStoreContextStore ([356b06bf](https://github.com/dereekb/dbx-components/commit/356b06bfe96326baeccf319e929a736323594121))
- added DbxFirebaseDocumentStoreRouteKeyDirective ([c3364516](https://github.com/dereekb/dbx-components/commit/c3364516e9c08998adeeece4ffdfa97a68fc7902))
- added DbxFirebaseEmulatorService ([a9035eff](https://github.com/dereekb/dbx-components/commit/a9035efff3a9cc3d92c19ab76694a63080c8db24))
- added DbxFirebaseIdRouteParamRedirectInstance ([4b915688](https://github.com/dereekb/dbx-components/commit/4b91568858b63935932438333b884b4cbc667a6b))
- added DbxFirebaseModelEntitiesDebugWidgetComponent ([ebba818d](https://github.com/dereekb/dbx-components/commit/ebba818d6a45a434716e3e43fb74b1cbf6796c27))
- added dbxFirebaseSourceSelectLoadSource() ([08e50568](https://github.com/dereekb/dbx-components/commit/08e50568b859575bf50fa19c723c33d6a255e070))
- added DbxFirebaseStorageFileDownloadButton ([6b1bd136](https://github.com/dereekb/dbx-components/commit/6b1bd1362b4b744d0aa6fa89314f47896f12a953))
- added DbxFirebaseStorageFileDownloadService ([174320c1](https://github.com/dereekb/dbx-components/commit/174320c1623b36e410c625510196fddbf8a693ff))
- added DbxFormLoggerDirective ([a77bd17f](https://github.com/dereekb/dbx-components/commit/a77bd17f86a69cb0d453896153dd01044c336857))
- added DbxHelp services ([4ab13088](https://github.com/dereekb/dbx-components/commit/4ab13088bafca53a322fecc10bc829e0b707dd49))
- added DbxIfSidenavDisplayModeDirective ([2d08c80c](https://github.com/dereekb/dbx-components/commit/2d08c80c20e7de6e163748d0e30ac5ae98f40dd0))
- added DbxInjectionComponent config to DbxFilterComponent ([9646eb4f](https://github.com/dereekb/dbx-components/commit/9646eb4f1d396b421984cd82c6ec5a27c511258b))
- added DbxLinkifyService ([b6168a92](https://github.com/dereekb/dbx-components/commit/b6168a92a3746d56092087d48f75bc499282c2ec))
- added DbxListViewMetaIconComponent ([cd957e08](https://github.com/dereekb/dbx-components/commit/cd957e0849c920564b95e34c3d622c00ddca4e5f))
- added DbxMapboxChangeDetectorRefService ([f6c6dfad](https://github.com/dereekb/dbx-components/commit/f6c6dfad078bb59e7711cfff0b7bbb2083a8e56a))
- added DbxMapboxChangeService ([f007f45a](https://github.com/dereekb/dbx-components/commit/f007f45afbaa14927157774b43035255213caaf3))
- added DbxMapboxMapStore bound settings ([76a3c8d1](https://github.com/dereekb/dbx-components/commit/76a3c8d1856c2c55fde6c07593d762a7ff642674))
- added DbxPopoverCloseButtonComponent ([b629519e](https://github.com/dereekb/dbx-components/commit/b629519e7887b62f5fbad239faea7ac2d8223af7))
- added dbxScheduleSelectionCalendar config ([73544674](https://github.com/dereekb/dbx-components/commit/7354467476372413cef4fa8ef89a953f119c8741))
- added DbxStepBlockComponent, removed old step layout ([c48da438](https://github.com/dereekb/dbx-components/commit/c48da43890dae2b46095a56825ef1e0203205ffc))
- added dbxTableReader ([c1a174ce](https://github.com/dereekb/dbx-components/commit/c1a174ceaabf27917ee930f8e761c55e3cd9640c))
- added DbxTextCompatModule ([19d73d63](https://github.com/dereekb/dbx-components/commit/19d73d6397f0510ce20b168e14525c06b0ff2f28))
- added dbxTwoColumnSrefShowRight ([6f2237e4](https://github.com/dereekb/dbx-components/commit/6f2237e49ed10188711a9a6ade8dac86b9e0210d))
- added DbxWebPageTitleInfoDirective ([3a90265c](https://github.com/dereekb/dbx-components/commit/3a90265c23632abbcdfa606880c28f6bb6d60edb))
- added DEFAULT_LAT_LNG_STRING_VALUE ([6def0eef](https://github.com/dereekb/dbx-components/commit/6def0eeffae2a76266c5f018be2e82a4ec9def7f))
- added defaultLatLngString() ([2a4e0721](https://github.com/dereekb/dbx-components/commit/2a4e0721ff329cfb9df74a5ccd144c1509e03f58))
- added defaultScheduleDays to dateScheduleRangeField() ([57454df6](https://github.com/dereekb/dbx-components/commit/57454df661a8f1bbc8115f4368099683eb8fcb40))
- added defaultText to dbx-navbar ([14af8a4f](https://github.com/dereekb/dbx-components/commit/14af8a4fb49e0fe3e774fb0ba41af52c4d970122))
- added deleteNotes() ([c818b511](https://github.com/dereekb/dbx-components/commit/c818b511baa4705d13bea441da9700f9e60c089a))
- added destroyInstance to ModelTestContextFactoryParams ([1befaac5](https://github.com/dereekb/dbx-components/commit/1befaac53fd86f3d97e487925bb6f3819d20dc35))
- added detectPdfEncryption to @dereekb/nestjs ([7e2a5e98](https://github.com/dereekb/dbx-components/commit/7e2a5e98284752ba90cddb0242f2e8296ac9641e))
- added developerToolsEnabled to FirebaseServerEnvService ([2c5a31b2](https://github.com/dereekb/dbx-components/commit/2c5a31b22d04c7cfaff3da95a8184ac548dc6f02))
- added dialogContentConfig to dateScheduleRangeField() ([8c854a2a](https://github.com/dereekb/dbx-components/commit/8c854a2affee83997da8a4974978a1824c75f6bc))
- added disabled to dbx-filter-popover-button ([5d783e6a](https://github.com/dereekb/dbx-components/commit/5d783e6a5eebec0ae7131318bc2ca70f07f0f764))
- added discord public key format validation ([ab202ea9](https://github.com/dereekb/dbx-components/commit/ab202ea9b235338e6af7dc3d51e0aac890babec0))
- added distinctLoadingState() ([7b0246ec](https://github.com/dereekb/dbx-components/commit/7b0246ec1c4b1adf29980e66d194fefa931a731c))
- added DocumentDataWithIdAndKey ([87280eae](https://github.com/dereekb/dbx-components/commit/87280eaef58d6c1d89a22ae50073b1b1712e2c43))
- added DollarAmountPipe ([505662fd](https://github.com/dereekb/dbx-components/commit/505662fd0c02e913d3fe545f3d7d24203122cfcb))
- added durationSpanFromDateRange() and tests ([23070923](https://github.com/dereekb/dbx-components/commit/23070923bb1b5532dd8516781ed665131a6ba8ca))
- added E164PhoneNumberExtensionPair ([391a7c7a](https://github.com/dereekb/dbx-components/commit/391a7c7a47ef507d0f39cf3516009e8e1a7e4e5f))
- added earliestDate() ([328ab368](https://github.com/dereekb/dbx-components/commit/328ab368cd12235f0f42d0aff59d911272c9bc9a))
- added echo overlay support to bar button ([a39e3102](https://github.com/dereekb/dbx-components/commit/a39e3102f1737a8307e78c8014ce5e24552ac051))
- added embed demo ([09553f06](https://github.com/dereekb/dbx-components/commit/09553f069d5fcba76fba58599bb3a7a8e3858ede))
- added EMPTY_ARKTYPE_TYPE and emptyType() utility ([b37e1376](https://github.com/dereekb/dbx-components/commit/b37e1376c90e3966bf8052fdcbfe6256affba41e))
- added emptyLoading to dbx-list ([3d919f3c](https://github.com/dereekb/dbx-components/commit/3d919f3cade153c5b27f514c42a02e29e36170fb))
- added enableMultiTabIndexedDbPersistence() usage ([18334b49](https://github.com/dereekb/dbx-components/commit/18334b49fca0fae49843b121b1aa9e9d406c7d7d))
- added encrypted pdf utility ([ebb2f8e1](https://github.com/dereekb/dbx-components/commit/ebb2f8e18f4e7337b4a8f03fff908510c1756f19))
- added endOfDayInSystemDate to DateTimezoneUtcNormalInstance ([69b3367f](https://github.com/dereekb/dbx-components/commit/69b3367f7176ba7643d05e38c457c6eaf9281104))
- added env service API and webhook URL fields ([859ef3c0](https://github.com/dereekb/dbx-components/commit/859ef3c02ffe36f68759c9ae59e93eeffff5ec13))
- added env service to firebaseAdminNestContextWithFixture() ([90b2e5db](https://github.com/dereekb/dbx-components/commit/90b2e5dbe84738ed25c8b93028333918925c93c3))
- added error snackbar ([9fe10186](https://github.com/dereekb/dbx-components/commit/9fe10186be01ce08c846da11ecf2d255aed04838))
- added errorOnEmissionsInPeriod ([61b49c9e](https://github.com/dereekb/dbx-components/commit/61b49c9eae0dee679a9b90a2d9688c2a6baaa5c1))
- added exclude to FilterUniqueStringsTransformConfig ([0b2396ea](https://github.com/dereekb/dbx-components/commit/0b2396ea51a4c0fffdd498d75f91f3ca8f29d2e2))
- added exclusion to notification user ([8ea8a6b5](https://github.com/dereekb/dbx-components/commit/8ea8a6b5a2760f68b5feae3d81c1f26ca9325935))
- added exclusions to dateScheduleRangeField() ([544b3f14](https://github.com/dereekb/dbx-components/commit/544b3f14d6cb6c9454d1b4c9048a4380099ccedd))
- added expandDateScheduleDayCodes() ([dbec3271](https://github.com/dereekb/dbx-components/commit/dbec32711090ff4dcb5065133d0811e47fb6ac70))
- added expandDateScheduleRange() ([82aea81b](https://github.com/dereekb/dbx-components/commit/82aea81b7a3ee7c18e00bc1cc67fbcd3ddcbf4e2))
- added expandTypeformWebhookFormResponse() ([9aa27d49](https://github.com/dereekb/dbx-components/commit/9aa27d49621f76172114ee5142e8da0f2169b4f6))
- added expandUniqueDateBlocks() ([2324a896](https://github.com/dereekb/dbx-components/commit/2324a89643905d3c56b2bc832e7488c80ae9b79f))
- added expediteProcessing to CreateStorageFileParams ([913bd1f3](https://github.com/dereekb/dbx-components/commit/913bd1f30d50498f090a6739b94755adcfe035ab))
- added ExpirationDetails ([bcb475b4](https://github.com/dereekb/dbx-components/commit/bcb475b44854bef237c6aa368a2e2180885ace4a))
- added exploreTreeFunction() ([383e27f3](https://github.com/dereekb/dbx-components/commit/383e27f332c3e7b99baecc076a777f95c70fbd04))
- added ExponentialPromiseRateLimiter ([315839e8](https://github.com/dereekb/dbx-components/commit/315839e82afe5815fbc5347ce28215df7a2bf4f3))
- added extension to phone field ([8a243e61](https://github.com/dereekb/dbx-components/commit/8a243e6198b5989417d5244ddd9e2a6110d801e4))
- added fetchFileFromUrl() ([f6986802](https://github.com/dereekb/dbx-components/commit/f6986802db4868bb9f39a2ac7eb9699ab9f1dc4d))
- added fetchJsonFunction(), fetchOk() ([4fc47fd0](https://github.com/dereekb/dbx-components/commit/4fc47fd0908a21b970a774490fa5c440e53d78e4))
- added fetchTimeout() ([0220c07f](https://github.com/dereekb/dbx-components/commit/0220c07ffa0a5923a2142b5768d90e980022cfa8))
- added fetchURL() ([b14c1d92](https://github.com/dereekb/dbx-components/commit/b14c1d92657734ec4c72a5ba5c4d5c41a21d1880))
- added filter popover header and icon customization config ([6c17eee0](https://github.com/dereekb/dbx-components/commit/6c17eee001c33f01c59d283d1b99fa9978e34cdb))
- added filterByViewportBound() to DbxMapboxMapStore ([bb301236](https://github.com/dereekb/dbx-components/commit/bb30123676befdec2714868f2c0f410d9d4de014))
- added filters to DateScheduleDateBlockTimingFilterConfig ([8c90a36c](https://github.com/dereekb/dbx-components/commit/8c90a36c50e95aa5f9ede381399ccfed6dd1d456))
- added filterUnique to firestoreObjectArray() config ([083bfcf0](https://github.com/dereekb/dbx-components/commit/083bfcf045efec76419ebf875d323a39e6aac7ac))
- added filterUnique to optionalFirestoreArrayField() ([0721c9c4](https://github.com/dereekb/dbx-components/commit/0721c9c46cfe96eb9824423e73618843f8e18bc9))
- added filterUniqueFunction() ([d77b8bd3](https://github.com/dereekb/dbx-components/commit/d77b8bd3f1700ee88022a52db0cf527a2b421fe3))
- added filterValuesToSet() ([49ec79b9](https://github.com/dereekb/dbx-components/commit/49ec79b935cfa9695304b503c02e6efcc112cf61))
- added filterWithDateRange ([4e1a77ac](https://github.com/dereekb/dbx-components/commit/4e1a77ac2767f6b6191e68313e0b9b31fff067aa))
- added findBestIndexMatchFunction() ([8b1cb358](https://github.com/dereekb/dbx-components/commit/8b1cb35813d8abc65a15bd520e5e54f5c0a1b0d4))
- added FirebaseAuthDetails ([ea059f44](https://github.com/dereekb/dbx-components/commit/ea059f4428ef527f5210b73fd9022c236f450b01))
- added FirebaseServerAuthResetUserPasswordClaims ([1d7f283f](https://github.com/dereekb/dbx-components/commit/1d7f283f0516b6706a9a22e8d679fc4f3a480009))
- added firestore model key pipes ([dbef044e](https://github.com/dereekb/dbx-components/commit/dbef044ee33909c711bfc822b61000981db7f71d))
- added FirestoreAccessorStreamMode ([1851172e](https://github.com/dereekb/dbx-components/commit/1851172eb4df6216d128b55fcf166d1af634f8b4))
- added firestoreBitwiseObjectMap() ([03b21a67](https://github.com/dereekb/dbx-components/commit/03b21a677802ffc8ae3f72b9c69ab1d843ffe921))
- added FirestoreDocumentSnapshotDataPairWithData ([bf67ab16](https://github.com/dereekb/dbx-components/commit/bf67ab16e867616a72abd05ad394fbd93b58f6ab))
- added FirestoreDocumentSnapshotDataTuple ([2ceb6ca8](https://github.com/dereekb/dbx-components/commit/2ceb6ca8be162ffaf14c7e81c84b8e5bca47cf4b))
- added firestoreEncryptedField to firebase-server ([9fdd3ee9](https://github.com/dereekb/dbx-components/commit/9fdd3ee94003c807d4905145e337e42cc6054972))
- added firestoreModelIdFromEmail() ([23919aaa](https://github.com/dereekb/dbx-components/commit/23919aaa899d4fab49da48654dee08acb7d0309f))
- added FirestoreModelIdInput type ([7e27f04e](https://github.com/dereekb/dbx-components/commit/7e27f04e7b01acdf5d6d3d9627f44f3d9bc924a0))
- added firestoreModelKeyCollectionName() ([fbab77c6](https://github.com/dereekb/dbx-components/commit/fbab77c6a60293ae0c79c5e3fec1a1316979dbbd))
- added firestoreModelKeyParentKey() ([ef5bb842](https://github.com/dereekb/dbx-components/commit/ef5bb842b5410dfcf7ca2b24e5988e582ced3506))
- added FirestoreStringTransformOptions to firestoreStringConfig ([afdc0dea](https://github.com/dereekb/dbx-components/commit/afdc0dea13e0c08f993615c2115cd1e0f592f19d))
- added fitPositions() to DbxMapboxMapStore ([75d9dd10](https://github.com/dereekb/dbx-components/commit/75d9dd10f816e01e950623d4700789e5ad90c233))
- added flat keys to ModelTestContext ([13fbe8b1](https://github.com/dereekb/dbx-components/commit/13fbe8b148d54d8dca26463ce26d6f4990c6e59d))
- added flatKey$ to DbxFirebaseDocumentStore ([05d1d22d](https://github.com/dereekb/dbx-components/commit/05d1d22db1497cbfcb0d3e324da0bc8fb49629b3))
- added format input to formatToDayRangeString() ([1ea9e586](https://github.com/dereekb/dbx-components/commit/1ea9e5861ee8ebd7ede3ae387f1b69e993433308))
- added formatDateRange() ([0b053b21](https://github.com/dereekb/dbx-components/commit/0b053b2130b0652ce452271cf71afb360bac0352))
- added fractional hour ([70ac1c15](https://github.com/dereekb/dbx-components/commit/70ac1c15c225987bc1592b6c7891aacb4f9a90d9))
- added fullSummaryRow to dbx-table ([ba423a1f](https://github.com/dereekb/dbx-components/commit/ba423a1ff825fd847c89851bc3edfff150cc949d))
- added generic to CalendarScheduleSelectionCellContentFactory ([0622b73e](https://github.com/dereekb/dbx-components/commit/0622b73e1fa563350b9e40bc060bf2cee6e54095))
- added generic type to TypedModel ([f945bfd4](https://github.com/dereekb/dbx-components/commit/f945bfd42e5f6af09a870beb92f206dcbf270e6c))
- added getAttachmentsForRecord() ([58ebee88](https://github.com/dereekb/dbx-components/commit/58ebee88fcf186d4177ba50b96304f46b9e751a9))
- added getCurrentDateBlockTimingOffset() ([370ee517](https://github.com/dereekb/dbx-components/commit/370ee517729d10fdeeccf9e7cd4cc17d8525d0e3))
- added getDateBlockTimingHoursInEvents() ([87a2462e](https://github.com/dereekb/dbx-components/commit/87a2462e1b49f645a1e6f00b322c32510b44ae18))
- added getDaysOfWeekNames(), getDaysOfWeekInDateRange() ([76d6ad7f](https://github.com/dereekb/dbx-components/commit/76d6ad7f371d573969b5309dc0dfcc3ffe97f01a))
- added getDocumentSnapshotData() ([c2eeab58](https://github.com/dereekb/dbx-components/commit/c2eeab58d9b628abf4da971b8003e0b010944f00))
- added getDocumentSnapshotDataPair() ([53ee5da9](https://github.com/dereekb/dbx-components/commit/53ee5da996a139d901cefbd8ad8dc3eeb67638b9))
- added getDocumentSnapshotPairs() ([d89757a9](https://github.com/dereekb/dbx-components/commit/d89757a995bccdf94ff5b9362105745f66145c62))
- added getGreatestDateBlockIndexInDateBlockRanges() ([599967af](https://github.com/dereekb/dbx-components/commit/599967afc639d67ae6fbc081a018e3cadf093afe))
- added getLeastAndGreatestDateBlockIndexInDateBlockRanges() ([cb1fa5b9](https://github.com/dereekb/dbx-components/commit/cb1fa5b936a9e1743c5d69602980ab0e5ab885d4))
- added getNextDateBlockTimingIndex() ([4e5fa20a](https://github.com/dereekb/dbx-components/commit/4e5fa20a8211f1024c535e5d24be3e6fc57c6f71))
- added globalApiRoutePrefix to NestServerInstanceConfig ([6b1692dd](https://github.com/dereekb/dbx-components/commit/6b1692dd731969739830ac9b907affec4d9d586a))
- added grey and disabled to dbxColor ([963e1694](https://github.com/dereekb/dbx-components/commit/963e16945100f2a8073f7d001f1ff4782b1c70a2))
- added groups to DbxTableView ([0451f640](https://github.com/dereekb/dbx-components/commit/0451f6404723279d1d8a3238c0047edb76aed133))
- added hasNextPage to PageLoadingState ([70c54ac3](https://github.com/dereekb/dbx-components/commit/70c54ac381bc08a4c4e8cce0a7d277f82b9989ac))
- added hasPortNumber() ([9b4e352f](https://github.com/dereekb/dbx-components/commit/9b4e352f4939a33711d20c9e75b9145af5cf3356))
- added hasSameTimezone() ([8e163706](https://github.com/dereekb/dbx-components/commit/8e163706ef9f7796ed36cba2d23c3f801ee87135))
- added hasSameValues ([5935d172](https://github.com/dereekb/dbx-components/commit/5935d1724046f4095275b5dc0b89f2cb57704f3d))
- added hasSignedTos to FirebaseServerAuthContext ([35754461](https://github.com/dereekb/dbx-components/commit/35754461bffbdf0a295943f3a597f73fd6e47826))
- added hideOnError to dbx-avatar config ([ff3084ef](https://github.com/dereekb/dbx-components/commit/ff3084ef28cafea7d6b9f5a589e05b8abe19baf9))
- added hint and content to dbx-anchor-list ([e1417f69](https://github.com/dereekb/dbx-components/commit/e1417f699bb8e9e048aef31bf08522c741b5ac9b))
- added hours and minutes to DateRangeType ([6e28d0b2](https://github.com/dereekb/dbx-components/commit/6e28d0b21f92555ba6a9b5fc185385f05fc6b47e))
- added hoursAndMinutesToString ([6b41a4ff](https://github.com/dereekb/dbx-components/commit/6b41a4fffe5849cbbbbdef0436371670f5f7cf0c))
- added icons to pickable/searchable fields ([336c986b](https://github.com/dereekb/dbx-components/commit/336c986b0dc12388ba64789f6cecbd406855e320))
- added IndexRange comparison functions ([b477e3e6](https://github.com/dereekb/dbx-components/commit/b477e3e601481db7e7bdb47a40fe4d00dfc61262))
- added initialSelection to DbxCalendarScheduleSelectionStore ([448ee2c7](https://github.com/dereekb/dbx-components/commit/448ee2c7f49b14238598a7b2721caaa57c715074))
- added invertDecision() ([fb75a09e](https://github.com/dereekb/dbx-components/commit/fb75a09ee6c6e3b82a721af22a770c2e28e426ff))
- added isAuthRouterEffectsEnabled$ to DbxAppAuthRouterService ([56a66091](https://github.com/dereekb/dbx-components/commit/56a66091cc969c699ba36e8000cb90dcfb81426a))
- added isBefore ([c206738f](https://github.com/dereekb/dbx-components/commit/c206738fea9db3d6e1bbcb8dc1d5bccaaed0d966))
- added isCompleteUnitedStatesAddress() ([90d8398e](https://github.com/dereekb/dbx-components/commit/90d8398eafdc4b1df28a2164122bde5ac8f836e6))
- added isEmptyDateScheduleEncodedWeek() ([4e11415b](https://github.com/dereekb/dbx-components/commit/4e11415bcf46f9c001fe6a42a16839d235b559d9))
- added IsFirestoreModelIdOrKey() ([a76a8e9f](https://github.com/dereekb/dbx-components/commit/a76a8e9f8e43f10f4229694f6bde34ab61070173))
- added IsMinuteOfDay validator ([ad783abe](https://github.com/dereekb/dbx-components/commit/ad783abef1a0239b11011d00d4d2b6792124ef15))
- added ISO8601DayString to DateTimingRelativeIndexFactory ([8721ec2a](https://github.com/dereekb/dbx-components/commit/8721ec2a7bd1a37852a4f3bc6fb64d21fae1df8e))
- added ISO8601DayString to DbxCalendarScheduleSelectionStore ([c2b3fb36](https://github.com/dereekb/dbx-components/commit/c2b3fb365511ac557e8c9f89dd880a5afa4fed40))
- added isolate for vitest watch ([b7502ae7](https://github.com/dereekb/dbx-components/commit/b7502ae70dc68742780795044652e3a38e7569ee))
- added isPublic, makePublic() to FirebaseStorageAccessorFile ([61961045](https://github.com/dereekb/dbx-components/commit/61961045ccebddadb39388b7926230af2cd8b86c))
- added isSameDateBlockTiming() ([e7f5d8ed](https://github.com/dereekb/dbx-components/commit/e7f5d8ed413cbe2880272ccff6ac7a66f8408a0b))
- added isSameDateDayRange() ([b3b3928c](https://github.com/dereekb/dbx-components/commit/b3b3928c241a3ee655519c06b191637f8872fcc6))
- added isStaging to FirebaseServerEnvService ([ed4aa351](https://github.com/dereekb/dbx-components/commit/ed4aa3514cdb2ccb05869a460fc9ea6a506319c8))
- added isStaging to ServerEnvironmentService ([a2a4bed9](https://github.com/dereekb/dbx-components/commit/a2a4bed9f96cdd9f73e89da82a268f05f27499b7))
- added isStandardInternetAccessibleWebsiteUrl() ([c7500422](https://github.com/dereekb/dbx-components/commit/c7500422cd52c0b58c32f40ae4ab4ff3bfbc48e1))
- added isUnderThreshold() ([06c91755](https://github.com/dereekb/dbx-components/commit/06c917556125023a7cdb79f961ccfb4d7efd85f5))
- added IsUniqueKeyed validator ([ed7d2809](https://github.com/dereekb/dbx-components/commit/ed7d280955eb2b6e9f9d86d031754bde111ea7fd))
- added isValidDateBlockIndex() ([edb9b695](https://github.com/dereekb/dbx-components/commit/edb9b695f0bc9af48347f870ea7c86d8ffc593fe))
- added IsValidDateBlockRangeSeries validator ([c19f7724](https://github.com/dereekb/dbx-components/commit/c19f7724233b2853b7431597d34386d76fe84cf6))
- added IsValidDateBlockTiming() ([70368071](https://github.com/dereekb/dbx-components/commit/70368071e6c9e34fbdcfe53ae0c0669c057c3a8f))
- added isWebsiteUrlWithPrefix() and validators ([f88319d0](https://github.com/dereekb/dbx-components/commit/f88319d03105f73e191ca25f36163a4b11b9fbd1))
- added itemsPerPage default value ([fb3ccf45](https://github.com/dereekb/dbx-components/commit/fb3ccf4567df04a539b3c98a047a026feb9ac707))
- added iterableToSet() ([badfb743](https://github.com/dereekb/dbx-components/commit/badfb7430a5e4a6bbf42c40b527497b400324a19))
- added iterateDaysInDateRangeFunction() ([569b0916](https://github.com/dereekb/dbx-components/commit/569b09165beab726a783a67b4cb8edef43689426))
- added iterateFetchPagesByEachItem() ([ff2c6de8](https://github.com/dereekb/dbx-components/commit/ff2c6de82bff86d0b6f78f903bf32fbedcb14d9c))
- added iterateFetchPagesByItems() ([bb5a027a](https://github.com/dereekb/dbx-components/commit/bb5a027af91b57f242429633a7af2b536d87c7da))
- added iterateFirestoreDocumentSnapshotPairs() ([f90b1eea](https://github.com/dereekb/dbx-components/commit/f90b1eea4904de209c42dec42b26a4e2bed14c94))
- added jestExpectFailAssertHttpErrorServerErrorCode() ([093b25c4](https://github.com/dereekb/dbx-components/commit/093b25c4811493005f57d5d76b1919dd335710c8))
- added jsdocs to dbx-core rxjs components ([ef7538e9](https://github.com/dereekb/dbx-components/commit/ef7538e939b44b6ac9766fda7149f058e6042087))
- added keepFromSetCopy() ([d953eb79](https://github.com/dereekb/dbx-components/commit/d953eb79b0998b3074653eb66649ddcc21e35682))
- added labeledValueMap ([f4ce6166](https://github.com/dereekb/dbx-components/commit/f4ce6166fbda310832525df76ef104f577aaf226))
- added large to dbx-content-container ([731c400e](https://github.com/dereekb/dbx-components/commit/731c400e8fa103f01ce643ecb5fbf22a43c62275))
- added lastRefreshTime to FirebaseAuthToken ([2a05dd98](https://github.com/dereekb/dbx-components/commit/2a05dd980fc3f1368121e05bd8587a364343e9bc))
- added latestSuccessfulRoutes() ([8a578864](https://github.com/dereekb/dbx-components/commit/8a5788648e02d96f5c08e07969d0d6c53ec6ecb6))
- added latLngPointType and latLngStringType ([684c8365](https://github.com/dereekb/dbx-components/commit/684c8365cdccab28fc500db3b9fea118570f0909))
- added limitPerCheckpoint to loadAllFirestoreDocumentSnapshot() ([552e8a08](https://github.com/dereekb/dbx-components/commit/552e8a0870c17676e3ffe3e7e3810412039b84eb))
- added loadAllFirestoreDocumentSnapshotPairs() ([e33a1730](https://github.com/dereekb/dbx-components/commit/e33a17302583e09f95e3f6b82273d413f01a1eac))
- added loadPagesUntilResultsCount to DbxFirebaseCollectionStore ([feb8840f](https://github.com/dereekb/dbx-components/commit/feb8840fbb13f595e507d1eb1b179a2c73e7c1d7))
- added loadSetupDetails() to FirebaseServerNewUserService ([474bc727](https://github.com/dereekb/dbx-components/commit/474bc7275ad710362bbe83a1586127d969d5da64))
- added lockMapToZoomLevels option ([4a8190ee](https://github.com/dereekb/dbx-components/commit/4a8190ee8874de106b202e62de5457a74415cf4e))
- added M3 type-role text utilities ([7c528985](https://github.com/dereekb/dbx-components/commit/7c528985cbd6d99eb80d771a24204cf285dd87ab))
- added mailgun env variables ([b23f154f](https://github.com/dereekb/dbx-components/commit/b23f154f5d43c4add79afe88a3ebb864e69c7152))
- added mailgun options ([49d9b533](https://github.com/dereekb/dbx-components/commit/49d9b533e1c755ca1c0fbb03e566a6b5007b239e))
- added MailgunRecipientBatchSendTarget ([556037f6](https://github.com/dereekb/dbx-components/commit/556037f62a46379270aac9f48701d585965222aa))
- added MailgunService usage to demo ([ee24eb37](https://github.com/dereekb/dbx-components/commit/ee24eb37fd2096797aae6a8bd81eaa9486469fbb))
- added make-error as a dependency ([5d41a729](https://github.com/dereekb/dbx-components/commit/5d41a729c8c20af4599f64bbe3742b76866ca44e))
- added map realignment on drawer change ([b506198e](https://github.com/dereekb/dbx-components/commit/b506198e75b96b90579c91121c67ee5572d89be9))
- added mapbox layout drawer min width ([305cc632](https://github.com/dereekb/dbx-components/commit/305cc63203c701c8b38a9a928d006e0e847e1948))
- added mapCanvasSize$ to DbxMapboxMapStore ([61ef3a8d](https://github.com/dereekb/dbx-components/commit/61ef3a8dd4659056552f6c31f43dcc64d156274e))
- added mapFetchJsonInput to FetchJsonFunctionConfig ([53037929](https://github.com/dereekb/dbx-components/commit/53037929054684aa9a9e195763815d9eaf7b34b0))
- added mapLoadingStateValueWithOperator() ([ef8c6c24](https://github.com/dereekb/dbx-components/commit/ef8c6c24e5844076a24a7743c3cbcf3de810ceab))
- added mapMaybe, mapIf rxjs functions ([684ba704](https://github.com/dereekb/dbx-components/commit/684ba70408ea84a80dd30c24f6cbfd76808dab71))
- added mat-icon-button size to dbx-button ([b11cd79d](https://github.com/dereekb/dbx-components/commit/b11cd79d4530fd674ae08b676143a70d48a1b0d9))
- added materialFormField to dbx-form template configs ([98123308](https://github.com/dereekb/dbx-components/commit/9812330846c7b478a8cc4714a2eaf697880822ce))
- added max parallel reads to getDocumentSnapshotDataPairs() ([4110bfd9](https://github.com/dereekb/dbx-components/commit/4110bfd9dc69aa0bf1f49c500a0c512bf98ebe28))
- added maxRetries config to ZohoRateLimitedFetchHandlerConfig ([71cb5b23](https://github.com/dereekb/dbx-components/commit/71cb5b2303ed647a95020e1c2d9a8ed3b867262c))
- added menu caret to dbx-navbar ([d2f0f1b2](https://github.com/dereekb/dbx-components/commit/d2f0f1b2f7c04f7d44de0bb1cea6f30f6c645cf5))
- added mergeRequestInits() ([392202f8](https://github.com/dereekb/dbx-components/commit/392202f854d2500882a85bbf94d1e543523b4cc3))
- added mergeZohoAccountsAccessTokenCacheServices() ([b3b51747](https://github.com/dereekb/dbx-components/commit/b3b517478a1af6eacfced71511672521a1756898))
- added meta value to SplitStringTree ([48b0db41](https://github.com/dereekb/dbx-components/commit/48b0db4128c2dcadc973fd36f44256232c1381d6))
- added min and max date to calendar components/stores ([b46e6582](https://github.com/dereekb/dbx-components/commit/b46e658208686e27ba3c4d53191a10f62472c477))
- added MinuteOfDay ([8d56dfa2](https://github.com/dereekb/dbx-components/commit/8d56dfa226c3b2b61632644c440416877ae56143))
- added MinutesAndSeconds ([cc333920](https://github.com/dereekb/dbx-components/commit/cc3339201585e70f40947fece2188064ce1a9fca))
- added minuteStep to dateTime field ([8a5d3d6c](https://github.com/dereekb/dbx-components/commit/8a5d3d6ce975263e882b0e54dc26b66f98494df7))
- added missing dependency ([bfa92abf](https://github.com/dereekb/dbx-components/commit/bfa92abfdef61eb29687c248997c046de8cf0fda))
- added missing destroys for rxjs subjects ([43d01aee](https://github.com/dereekb/dbx-components/commit/43d01aee610d0e97a59227953f5778f2e4341c78))
- added missing export in number util index ([e603f5a0](https://github.com/dereekb/dbx-components/commit/e603f5a03e881fc9372872c5c5250e09d5287033))
- added missing markerConfig to mapboxLatLngField() ([3c5a5989](https://github.com/dereekb/dbx-components/commit/3c5a5989b1b57e8815a2cad02f45ea3d1773f32f))
- added missing package ([1845b7d9](https://github.com/dereekb/dbx-components/commit/1845b7d91062d9c6d6f9e4b7024142d462fd4d9b))
- added model id to DbxFirebaseModelKeyComponent ([e9c54291](https://github.com/dereekb/dbx-components/commit/e9c542916cd9cfa8ecc485fc3069974f5f84606e))
- added ModelFirebaseCrudFunctionTypeMapEntryWithReturnType ([cfc2f950](https://github.com/dereekb/dbx-components/commit/cfc2f95077026d85a19b4195acf0dcfbd00dfc34))
- added more options to dateBlocksExpansionFactory() ([c4d4b5e3](https://github.com/dereekb/dbx-components/commit/c4d4b5e3fee1275f57d96be544957155cd5aede0))
- added mouseenter and mouseleave to dbx-anchor ([8b501c31](https://github.com/dereekb/dbx-components/commit/8b501c3131be7ae28841f1cefefe31604ee5fd22))
- added MouseEventPair ([bf235ad7](https://github.com/dereekb/dbx-components/commit/bf235ad777ba61802b3d0018a5696f835736becc))
- added multiSelect to pickableItemChipField() ([87ce0601](https://github.com/dereekb/dbx-components/commit/87ce0601e268763ea6d3d524aba63fc5df7af6bd))
- added name usage to DbxFirebaseModelEntitiesEntityComponent ([f7a8155e](https://github.com/dereekb/dbx-components/commit/f7a8155ebb539227a8fbb38e2a2dd7f676e1ebc3))
- added nestjs typeform demo configurations ([6c7bb89e](https://github.com/dereekb/dbx-components/commit/6c7bb89e7662a9c52a9d295b3f9c0638b1fbef0c))
- added nestjs typeform integration ([953cd59f](https://github.com/dereekb/dbx-components/commit/953cd59f5412ec4893f38969b53b6ff7a09af6f2))
- added newWithInjector() ([9968671d](https://github.com/dereekb/dbx-components/commit/9968671de3bb8c867db3f9c8f580f224651b6899))
- added ng-content to dbx-bar ([87b08958](https://github.com/dereekb/dbx-components/commit/87b08958741704db4e46b15bacf2ec6442cdadda))
- added nonConcurrentTaskKeyFactory option to performAsyncTasks ([f2d257d3](https://github.com/dereekb/dbx-components/commit/f2d257d36406cbdeb2d67b19825625ec156a792e))
- added NotificationDocumentStore ([c5e9a339](https://github.com/dereekb/dbx-components/commit/c5e9a339df2d2db367cadd9ddd38e0a5974ae7c8))
- added NotificationLoggedEvent ([5b404553](https://github.com/dereekb/dbx-components/commit/5b4045536ab14cb33387c586f3b91d6debcc3ab4))
- added notificationTaskSubtaskNotificationTaskHandlerFactory() ([8e3d48ad](https://github.com/dereekb/dbx-components/commit/8e3d48ad39b7b9efe61dd846fd438ece9de265a6))
- added NotificationTemplateTypeInfoAlternativeModelIdentityPair ([54e74347](https://github.com/dereekb/dbx-components/commit/54e7434792311782e9ab9b32cadf50737eb6beb0))
- added NotificationTemplateTypeInfoIdentityInfo ([677292ac](https://github.com/dereekb/dbx-components/commit/677292acccaf24f863f7aa7900cdc9203fe9a090))
- added now param to dateRangeState() ([475b5a62](https://github.com/dereekb/dbx-components/commit/475b5a62b87b081063035b4611e5cc3be3de93f1))
- added nowrap to dbx-chip ([1e7cb502](https://github.com/dereekb/dbx-components/commit/1e7cb502d02a09a94b865795bf8a15026173a81a))
- added numberSliderField() ([ae51903b](https://github.com/dereekb/dbx-components/commit/ae51903bd04b8c194cefd736ace62b84f42fea5b))
- added NumberStringDencoder ([54decbae](https://github.com/dereekb/dbx-components/commit/54decbaef50aaa2e8d591175faaa16e54bc648be))
- added ObjectDeltaArrayCompressor ([5b2e3422](https://github.com/dereekb/dbx-components/commit/5b2e3422315db71cb78b87d54ba8ce07e8407455))
- added oidc ttl options ([b676bff2](https://github.com/dereekb/dbx-components/commit/b676bff23abc7f07d28fe8799506e525c06f3587))
- added ok and success to DbxThemeColor ([02aea561](https://github.com/dereekb/dbx-components/commit/02aea561fe494a10ad06e0cc7eb855b68b6d3810))
- added onCall configuration options ([7733e38d](https://github.com/dereekb/dbx-components/commit/7733e38daae13dde3d528d7d775ff42b978fc562))
- added onCallModel ([11e51012](https://github.com/dereekb/dbx-components/commit/11e51012f419a3b0aec2027c48758a4728e9a82e))
- added onSendSuccess to notification config ([feceb231](https://github.com/dereekb/dbx-components/commit/feceb2312764927390bbc5cfe3f1fc252f3f020d))
- added onTooManyRequests to ZohoRateLimitedFetchHandlerConfig ([a12ffdfc](https://github.com/dereekb/dbx-components/commit/a12ffdfc9a8acf03c0b6081aeba4155f0ee4f6a4))
- added OpenAIPromptId ([ec00968a](https://github.com/dereekb/dbx-components/commit/ec00968ae35434bf7013fb48eaa5b37a891b0cd4))
- added openedChange to DbxMapboxLayoutComponent ([7c0831e6](https://github.com/dereekb/dbx-components/commit/7c0831e6bb37b930e39b52af3aa5e6a96bf1acee))
- added optional footerComponent to DbxListTitleGroupDirective ([0c30804d](https://github.com/dereekb/dbx-components/commit/0c30804de88969dccb49fcbf72ecc1be84e764f1))
- added optionalFirestoreField() ([ad1b2a85](https://github.com/dereekb/dbx-components/commit/ad1b2a857412800d7b32f60918b57ea93517a570))
- added origin to SourceSelectOpenFunction as param ([11e19622](https://github.com/dereekb/dbx-components/commit/11e196228accd9c73c2ad60c42ff74acb0e62f3a))
- added package.json dependencies fixing to eslint config ([43d9c54e](https://github.com/dereekb/dbx-components/commit/43d9c54ecc11e3dfbdc7dd71e243fa813c1f5942))
- added padding option to dbx-loading ([15f4549c](https://github.com/dereekb/dbx-components/commit/15f4549c6ef46b9a7c6cdd0468f26979bc401598))
- added paged-item firestore subcollection ([4f78829e](https://github.com/dereekb/dbx-components/commit/4f78829ef5605607661e906ad968197b6761bf6a))
- added parallel to iterateFirestoreDocumentSnapshotCheckpoints ([16c99fa0](https://github.com/dereekb/dbx-components/commit/16c99fa033549aefd3627943ba845901c0370a4a))
- added parentKey$ to AbstractDbxFirebaseDocumentWithParentStore ([a35e374c](https://github.com/dereekb/dbx-components/commit/a35e374c9e0ded0ac5e069491ba417e812813901))
- added parseOpenAIJsonResponse() ([16c839cc](https://github.com/dereekb/dbx-components/commit/16c839cc067d7a7782980d578f9a25ed6dd1b4d3))
- added parsers and expressions to FieldConfig ([306451b0](https://github.com/dereekb/dbx-components/commit/306451b0a38f2a756d686b5f3b2d916c70d26ed4))
- added password reset service and UI ([76e0dd36](https://github.com/dereekb/dbx-components/commit/76e0dd36c7ff8cdfa03e94fbeb9ae09c53c4c216))
- added path input to ModelStorageSlashPathFactory ([1bd550c7](https://github.com/dereekb/dbx-components/commit/1bd550c7cbfcd58d4ec8f8849e5c6e1907186c25))
- added PercentNumber ([d9cd53f6](https://github.com/dereekb/dbx-components/commit/d9cd53f68bf9458affa6c6cc9076cd45ed1275c9))
- added performTasksFromFactoryInParallelFunction() ([fc0d816a](https://github.com/dereekb/dbx-components/commit/fc0d816a5163d4015a590579ce3d23d89d0fe4e3))
- added performTasksInParallel() ([6c4a7904](https://github.com/dereekb/dbx-components/commit/6c4a7904170220f3fa9ca9aebc4ea63cee7025d6))
- added performTasksInParallelFunction multiple keys per task ([cad5f672](https://github.com/dereekb/dbx-components/commit/cad5f67254df44216b5a351e4a0c4d383b876b39))
- added performTaskWithLoadingState() to WorkInstance ([3419122a](https://github.com/dereekb/dbx-components/commit/3419122a3bcf59942175b35ccd6e967ac005c372))
- added pickableValueFieldValuesConfigForStaticLabeledValues() ([dadd7035](https://github.com/dereekb/dbx-components/commit/dadd7035684e8a19be4a508eb77c05dd8e5fde09))
- added preAssert to onCall crud functions ([ee055f27](https://github.com/dereekb/dbx-components/commit/ee055f27a6be728250758a60e62dc5ac6ad22b98))
- added precision to randomLatLngFactory() config ([cd358093](https://github.com/dereekb/dbx-components/commit/cd358093c1727cdd5c6eb9e585a971687abefa67))
- added randomLatLngFromCenterFactory() ([1a65eea6](https://github.com/dereekb/dbx-components/commit/1a65eea6337eff701f97a216b28a096cbd526fdd))
- added ReadFirestoreModelKeyInput ([2e585d7f](https://github.com/dereekb/dbx-components/commit/2e585d7f899240e5499fa28f56faed9d6a956c71))
- added ReadMultipleKeysFunction type ([8d659788](https://github.com/dereekb/dbx-components/commit/8d659788b1c19b780ba42bbd162e17c6e6858859))
- added readonly to DbxScheduleSelectionCalendarComponent ([4b5b2e2a](https://github.com/dereekb/dbx-components/commit/4b5b2e2a5b20081963b4c7767ca760f2ab70bf81))
- added redirectForIdentifierParamHook() ([44375d56](https://github.com/dereekb/dbx-components/commit/44375d56b9a3d4e75aaba06300a55c4405b29e64))
- added refreshDisplayValues$ to PickableValueFieldsFieldProps ([44baeed4](https://github.com/dereekb/dbx-components/commit/44baeed44e644f71f7d41b20ecea8755f4941dac))
- added replyTo to MailgunTemplateEmailRequest ([2ea6242f](https://github.com/dereekb/dbx-components/commit/2ea6242fd9cfc31743df6567742683a0fae66f86))
- added resetPeriodPromiseRateLimiter() ([927f58ea](https://github.com/dereekb/dbx-components/commit/927f58ead1b0396f103b37b10ad7bb5b4e04a746))
- added RootSingleItemFirestoreCollection ([715456ad](https://github.com/dereekb/dbx-components/commit/715456ade7c75da6009c52604548b11546cd0170))
- added rootSingleItemFirestoreCollection() to FirestoreContext ([d0ddfd19](https://github.com/dereekb/dbx-components/commit/d0ddfd199e0ea54a4f3455b2d84385a117a259a6))
- added rotate button mode to dbx-navbar ([80e905cb](https://github.com/dereekb/dbx-components/commit/80e905cb0d9a13c0c6f6cd16220967a208824291))
- added run_build param to circleci ([903d4ca1](https://github.com/dereekb/dbx-components/commit/903d4ca1488accf2900d263a0c908e457e8301b5))
- added safeFormattoISO8601DateString ([d778780e](https://github.com/dereekb/dbx-components/commit/d778780e80933cd54a73101464a6ebe90b091ba9))
- added sanitizeDbxDialogContentConfig() ([c3d8dec2](https://github.com/dereekb/dbx-components/commit/c3d8dec254ddb7e5d0219970d99cec28b7c73b29))
- added SavedToFirestoreIfTrue, SavedToFirestoreIfFalse ([c5ab5951](https://github.com/dereekb/dbx-components/commit/c5ab59517e7318355441134dfc72d70a8e00a566))
- added schedule filter to dateTimeField() ([0e376430](https://github.com/dereekb/dbx-components/commit/0e376430fee987cab88c446d5036a09f2bc3cd9d))
- added search associated recruit records request ([09479521](https://github.com/dereekb/dbx-components/commit/09479521c61cdada2ad372f898549b9f10be7c26))
- added searchRecordsPageFactory() to Zoho Recruit ([811de4d1](https://github.com/dereekb/dbx-components/commit/811de4d114d6aca521566aeaa8ae28b046a6c88c))
- added select all button to dbx-schedule-selection-calendar ([b5e041ad](https://github.com/dereekb/dbx-components/commit/b5e041adf2f00ee714a6e7a75e0a08fa61f4128d))
- added selectLocationOnMapClick to mapbox latLng field ([785d4659](https://github.com/dereekb/dbx-components/commit/785d4659bc5b1cedd748026feb2f70312fa15f94))
- added sendSetupContentIfUserExists to initializeNewUser() ([995d74db](https://github.com/dereekb/dbx-components/commit/995d74db658089e40b93f72ec3bdfa59bd53e302))
- added sendTestEmails to mailgun config ([5778d957](https://github.com/dereekb/dbx-components/commit/5778d957d4b33c9c98e9842ddf749b04dc2064eb))
- added sequentialIncrementingNumberStringModelIdFactory() ([eae27ca3](https://github.com/dereekb/dbx-components/commit/eae27ca3efe86fb901162089b7f8139f8869e3c5))
- added SessionRecording to DbxAnalyticsStreamEventType ([9d39e709](https://github.com/dereekb/dbx-components/commit/9d39e7090b053f9257cc4b344a9606975c0508d9))
- added setCenterOnLocationSet configuration to latLng field ([1f717538](https://github.com/dereekb/dbx-components/commit/1f7175380f7253387d6e9226e95e174c95e4ad1c))
- added setDeltaFunction() ([78cf5d39](https://github.com/dereekb/dbx-components/commit/78cf5d39161169e05fd1880d75d50556132e6c9c))
- added setIdAndKeyFromSnapshotOnDocumentData() ([e1f5ea99](https://github.com/dereekb/dbx-components/commit/e1f5ea99fedb8ce3469bfb7bcbd97d016a43fbfc))
- added setMinimumVirtualViewportSize() to DbxMapboxMapStore ([efaf8bcb](https://github.com/dereekb/dbx-components/commit/efaf8bcb2445acd0061d33b5b7ec30e87a52ac87))
- added setParamValue() to DbxRouteParamReader ([02b92c89](https://github.com/dereekb/dbx-components/commit/02b92c89c05ab2cebb4ad6b5d287e388b07c035b))
- added shiftDateCellTimingToTimezoneFunction() ([8de564ab](https://github.com/dereekb/dbx-components/commit/8de564ab28fbd600de9ff992327f5b8de01fef58))
- added showPageButtons$ to DbxCalendarStore ([e46520cb](https://github.com/dereekb/dbx-components/commit/e46520cb4a0a3f50163458a4937f7df75d734a57))
- added sidenav position, displayMode, and css tokens ([301bd3d6](https://github.com/dereekb/dbx-components/commit/301bd3d60d7adc2fe291e18a79486f8f308ae4c9))
- added sidenavMenuIcon option to dbx-sidenav-page ([e585a0a0](https://github.com/dereekb/dbx-components/commit/e585a0a0097113d52f054e42742bbd06ed8cc400))
- added sidenavMenuIcon option to sidenav ([30d1ccf0](https://github.com/dereekb/dbx-components/commit/30d1ccf0a4956c6310e73fd837f44c13759337ed))
- added snapshot cache for document accessor ([b3bee1b3](https://github.com/dereekb/dbx-components/commit/b3bee1b3a1416b60d9603cc1307e89a3dbdfcd46))
- added sonar-project.properties ([a825e232](https://github.com/dereekb/dbx-components/commit/a825e2328caa610eba1dfe38372666da4a255c41))
- added sort options to firestore array fields ([d46b5495](https://github.com/dereekb/dbx-components/commit/d46b549507a9e2b05a9c5143f21115bf93bc79a0))
- added sortByDateFunction() ([03ea080e](https://github.com/dereekb/dbx-components/commit/03ea080e5edbd326fe4dbc6f926bf4f34ea4c89b))
- added sortByNumberFunction() ([0fb425fd](https://github.com/dereekb/dbx-components/commit/0fb425fdaf955d8444dad5707afe507deed2d27a))
- added sortByStringFunction() ([ff0dccb8](https://github.com/dereekb/dbx-components/commit/ff0dccb875aa4b184f9f2392b284567d84a5e658))
- added SplitStringTree ([e3113a35](https://github.com/dereekb/dbx-components/commit/e3113a3566bb6723d192c45244fb3e3dde74425a))
- added srefBuilder to DbxModelTypeConfiguration ([c7eb4ba8](https://github.com/dereekb/dbx-components/commit/c7eb4ba81e94c4114265a7e9096e4cc6942067e8))
- added startLimitAt to ExponentialPromiseRateLimiterConfig ([61c658db](https://github.com/dereekb/dbx-components/commit/61c658db5c4de09a8695d96252f3aed007c2d3e8))
- added stepsFromIndexFunction() ([496655dd](https://github.com/dereekb/dbx-components/commit/496655dd41705eddb2aa24d63b9cd9eed965358c))
- added StorageFile to setup-project.sh ([e5baebd6](https://github.com/dereekb/dbx-components/commit/e5baebd697ad39fb5503509810f071f4a43b294f))
- added StorageFileDisplayName ([640a3f39](https://github.com/dereekb/dbx-components/commit/640a3f3984f108bc82efa115415c120ab454f874))
- added storageFileDownload ([1c9ef31a](https://github.com/dereekb/dbx-components/commit/1c9ef31a7933ee95118d457d7f8b2abfc8290068))
- added StorageFileGroupDocumentStore ([68627ff0](https://github.com/dereekb/dbx-components/commit/68627ff0d4a26701a89623821805cc6972e3f548))
- added storageFileGroupUpdate ([f2e73906](https://github.com/dereekb/dbx-components/commit/f2e7390637458232b30acee15103e0c1353b7cf7))
- added StorageFilePurposeSubgroup ([142f9985](https://github.com/dereekb/dbx-components/commit/142f99855d9a550c368e6d4dab62f1c2a421ff36))
- added StringOrder ([a7beb39a](https://github.com/dereekb/dbx-components/commit/a7beb39af218ba3172fab0d47066da60815a16d7))
- added subscriptionObject(), lockSet() ([c241d307](https://github.com/dereekb/dbx-components/commit/c241d307b2c6e0614afb41afd3aca89b72092202))
- added switchMapWhileFalse() ([315b5ebb](https://github.com/dereekb/dbx-components/commit/315b5ebbbaa97c0f7c30ca206a750e9dc4caed8e))
- added syncFields config to dateTimeField ([d9851870](https://github.com/dereekb/dbx-components/commit/d9851870d638ed3966c5568ea241b475f97eb7a3))
- added SystemStateCollectionStore ([6c432c35](https://github.com/dereekb/dbx-components/commit/6c432c353344b709af719310ccc2b82fc2878b40))
- added test ([1e5b445a](https://github.com/dereekb/dbx-components/commit/1e5b445a72d4348ee1995b61e7286f42a531b29a))
- added test files ([6c050048](https://github.com/dereekb/dbx-components/commit/6c050048fc590273ab7e424d92c0970d96758afe))
- added timeDate to dateTimeField ([576a4caa](https://github.com/dereekb/dbx-components/commit/576a4caa203f3fc052d84cc3b00a8374ddcf6bdf))
- added timeDurationField with text parsing and popover picker ([e41c12af](https://github.com/dereekb/dbx-components/commit/e41c12afab184ce3a74c72d584066bb4433781a7))
- added timezone abbreviation searching to timezonePicker() ([9b063f62](https://github.com/dereekb/dbx-components/commit/9b063f623bd375202b20b54d2c8124c619596591))
- added timezone to dateScheduleRangeField() ([a6a740d2](https://github.com/dereekb/dbx-components/commit/a6a740d20153c681e028d8571dca996d04c21782))
- added timezones to dateRangeField(), dateTimeRangeField() ([ed4f03e5](https://github.com/dereekb/dbx-components/commit/ed4f03e5704cfed4661f9ccda27828e7c3d6788f))
- added timezones to dateTimeField() ([cbad988e](https://github.com/dereekb/dbx-components/commit/cbad988ea399a245e0c3f0a19591f090273fac24))
- added timingIsInExpectedTimezoneFunction() ([7c6feb3e](https://github.com/dereekb/dbx-components/commit/7c6feb3e708b6666bd3b76bd6ab558162e018c63))
- added toISO8601DayStringForUTC ([1c5e1075](https://github.com/dereekb/dbx-components/commit/1c5e10752816de4dac76528695288490179f9b64))
- added top padding to dbx-content-container ([6d837912](https://github.com/dereekb/dbx-components/commit/6d837912c5f83bbc60978a3468f783ec1f15d7b5))
- added trackBy support to DbxListView ([f4e1bea1](https://github.com/dereekb/dbx-components/commit/f4e1bea1337051f6b98f2f1e8725afc8421b74d1))
- added transform to firestoreNumber ([65fb1f88](https://github.com/dereekb/dbx-components/commit/65fb1f880cfcb7ae15fdd7e5909dea63f16c57b0))
- added transformDateRangeToTimezone() ([8cf3bda8](https://github.com/dereekb/dbx-components/commit/8cf3bda82c076630d414c989c4ddf75d2c1a8ed6))
- added trustProxy config to odic module ([e51ed2ad](https://github.com/dereekb/dbx-components/commit/e51ed2adba9ca83c79a91d6ecebeda4d479ea66d))
- added tryConvertToE164PhoneNumber() ([85ccbbd8](https://github.com/dereekb/dbx-components/commit/85ccbbd8866dbc3492625654bd3111fb5372db41))
- added tryWithPromiseFactoriesFunction ([29726a83](https://github.com/dereekb/dbx-components/commit/29726a83f7a89a1096891a5c14edd51d4949ce33))
- added type and ref to IsDateInDateRange-related functions ([a5df618a](https://github.com/dereekb/dbx-components/commit/a5df618ac519eb29427ab3dcb84644299ea6916b))
- added type imports to project ([e5ab4162](https://github.com/dereekb/dbx-components/commit/e5ab4162a21651fc0d79e10784574473496ed349))
- added type-only import detection to rule ([72f6ee3d](https://github.com/dereekb/dbx-components/commit/72f6ee3db8729f0d2348164dc545b895421a8b89))
- added type-to-filter for sourceSelectField ([e7b07986](https://github.com/dereekb/dbx-components/commit/e7b0798699d505be0dae77d06f4e17b89d046a95))
- added typed auth error classes and nestApplication alias ([bef853e3](https://github.com/dereekb/dbx-components/commit/bef853e3c681f9318e8bea540c5dfe5f24668a71))
- added typeform source tracking URL parameter types ([32c60b4f](https://github.com/dereekb/dbx-components/commit/32c60b4fd69cfb729e069b26897b54b5e60aa756))
- added TypeformPublicFormUrl ([4dfb22f4](https://github.com/dereekb/dbx-components/commit/4dfb22f4b566d66bda8f1ea1a06c84036ef0d869))
- added unavailableOrDeactivatedFunctionError() ([a056bb07](https://github.com/dereekb/dbx-components/commit/a056bb0734ddb3ace0eeba49e945aef9cba3b220))
- added undefined option to mapLoadingStateValueWithOperator() ([d1228722](https://github.com/dereekb/dbx-components/commit/d1228722a96933a09f82982e38e0cbef2256e93b))
- added unlink mode and confirm skip to login ([1a7dfabc](https://github.com/dereekb/dbx-components/commit/1a7dfabc53436d77bf5f1fb9dd4d552733cc38c2))
- added updatedUser() to FirebaseServerAuthUserContext ([51ba06d6](https://github.com/dereekb/dbx-components/commit/51ba06d6c3bac20e43846ceac0d77af2665b72ee))
- added updateMeeting() to ZoomApi ([279578aa](https://github.com/dereekb/dbx-components/commit/279578aa4969e45c0c3190c7e85b73650853a3e3))
- added updateUrlSearchParams utility ([c06b40ba](https://github.com/dereekb/dbx-components/commit/c06b40ba50d367f722cd7f907f03816a542e5f73))
- added useRef to ModelTestContextParams ([99ef386a](https://github.com/dereekb/dbx-components/commit/99ef386a8952b59d91c54a7f6c3627b383ef6f82))
- added viewportBoundFunction$ to DbxMapboxMapStore ([71c54b64](https://github.com/dereekb/dbx-components/commit/71c54b642bffc475b519e37f82dc3aec3fe94b15))
- added websiteUrlField ([9e13d2e5](https://github.com/dereekb/dbx-components/commit/9e13d2e5c8aaddf5f06598341afbdb0f2548f65b))
- added websiteUrlFromPaths() ([2651915a](https://github.com/dereekb/dbx-components/commit/2651915a8e8a29895ef21545f4a1d8630ee3ae95))
- added whereDateIsAfterWithSort(), whereDateIsOnOrBefore() ([21f26003](https://github.com/dereekb/dbx-components/commit/21f260036fd5433b79ff1d80773dd4a8e0b4d244))
- added WhereFilterOpValue ([e0faba6a](https://github.com/dereekb/dbx-components/commit/e0faba6ae89d0e0513c3464a9c41a3bbfb4b15da))
- added YearMonthDayCode ([437f547d](https://github.com/dereekb/dbx-components/commit/437f547d2a3ffafc43bbe37b853daa3704851728))
- added yearWeekCodeForDateRange() ([2225465a](https://github.com/dereekb/dbx-components/commit/2225465a7eb96f0ed671b1261aabdf3f3732843d))
- added zoho recruit criteria utilities ([73d9b997](https://github.com/dereekb/dbx-components/commit/73d9b997396892e83bc90f3420f27e63568c0929))
- added zoho recruit delete records, get related records ([d8448352](https://github.com/dereekb/dbx-components/commit/d8448352a1babdb72d314be42dd5d389ab4e7a6c))
- added zoho recruit getEmailsForRecord() ([680dcb4b](https://github.com/dereekb/dbx-components/commit/680dcb4b1a0519f03d872af2f3d3cd7f2419ba8c))
- added Zoho Recruit Notes API calls ([fbcf7d68](https://github.com/dereekb/dbx-components/commit/fbcf7d681afdb990b1e7cb3045ed51eb9f449766))
- added zoho recruit tags api functions ([f3ef63bf](https://github.com/dereekb/dbx-components/commit/f3ef63bf1b9465c4f17e6a95e95241bbf08302e6))
- added zoho recruit upload and delete attachment requests ([c2f6542b](https://github.com/dereekb/dbx-components/commit/c2f6542b9199653e0e352248c85497c23b4cf1de))
- added zoho sign api library ([a05b484c](https://github.com/dereekb/dbx-components/commit/a05b484c10951d2127e7d84963b71cc4046d8a94))
- added zoho sign webhook controller ([d9b07225](https://github.com/dereekb/dbx-components/commit/d9b072256373cf018fa0e9de5a776beb09e17dbd))
- added ZohoDateTimeString ([1f88a180](https://github.com/dereekb/dbx-components/commit/1f88a1803eceecc77deec656c33329a7d0336d6e))
- added ZohoRateLimitedFetchHandler ([4c2d22bb](https://github.com/dereekb/dbx-components/commit/4c2d22bb4fd9b86a33d9191dee1e8e960793670d))
- added ZohoRecruitExecuteRestApiFunction ([988dc02b](https://github.com/dereekb/dbx-components/commit/988dc02b3fa8bc91c4970c49fc97a3d0477708c8))
- added ZohoRecruitUserId ([99106834](https://github.com/dereekb/dbx-components/commit/99106834efba85abe4dd8c97378ba3fe19bf000f))
- added ZoomLevelRef ([5f20e46a](https://github.com/dereekb/dbx-components/commit/5f20e46a961ed15d43585c2d1f1a16df3f899e67))
- additional compat removal/deprecations ([54fd3f21](https://github.com/dereekb/dbx-components/commit/54fd3f21ea6b73b58c70054e4a316d7322341dfd))
- additions ([e7110913](https://github.com/dereekb/dbx-components/commit/e711091343f9a559d8732a6d1b81ed32b092dccf))
- address sonarqube findings across packages ([67e167c1](https://github.com/dereekb/dbx-components/commit/67e167c1e5b9f1be4fc7f5be3baad17d8402e53a))
- address sonarqube phase 1 mechanical and phase 2 lint fixes ([3af63e62](https://github.com/dereekb/dbx-components/commit/3af63e622d7e950ccfbce6e372e326cb6d1dda99)), closes [String#replaceAll](https://github.com/dereekb/String/issues/replaceAll) [String#replace](https://github.com/dereekb/String/issues/replace)
- adjusted zoho rate limiting ([2cb7a143](https://github.com/dereekb/dbx-components/commit/2cb7a1432e3c60c26c92d44af37dcc7113c56ca9))
- allow Maybe for auth init user inputs ([2e773475](https://github.com/dereekb/dbx-components/commit/2e7734752e25ef157b4b3492bb97006702bca90e))
- allow Maybe for DbxButtonStyle and inputs ([eedeee25](https://github.com/dereekb/dbx-components/commit/eedeee2571555d27e6758217885ea6fdd6f09f43))
- anchor list style fix ([24bef898](https://github.com/dereekb/dbx-components/commit/24bef89864569354af7d114d61797ab962024a00))
- annotated reusable css utilities pass 2 ([4fb83581](https://github.com/dereekb/dbx-components/commit/4fb83581deea29474d4c974d0dbdad1c331ed0d4))
- appNotificationTemplateTypeInfoRecordService fix ([b5c01145](https://github.com/dereekb/dbx-components/commit/b5c01145b44976c8896f6253fc3276d6891946e2))
- arktype fixes ([a5a22a93](https://github.com/dereekb/dbx-components/commit/a5a22a939b63e009bd702e6f663f0946729ecb5d))
- boolean fields use form-field wrapper ([54f72a29](https://github.com/dereekb/dbx-components/commit/54f72a29933040cf82a1086619d9e4b8215a0945))
- break up test exports into projects ([81db3d57](https://github.com/dereekb/dbx-components/commit/81db3d57a4a44cf8998b9bea592f29399c1b1db7))
- build and deploy fixes ([fdc0821d](https://github.com/dereekb/dbx-components/commit/fdc0821d3ea34502c2004e08c2fb36f148775552))
- build configuration fix ([a3f04e1e](https://github.com/dereekb/dbx-components/commit/a3f04e1e9a0764882fee1fc2d34eebc753b54c98))
- build fix ([581235be](https://github.com/dereekb/dbx-components/commit/581235be69e1ae806f9f561b35b34dc9e0c84e94))
- build fix ([d81fdf96](https://github.com/dereekb/dbx-components/commit/d81fdf967fd22c3739d01604a1f5f8c21a20c4dc))
- build fix, updated use of provideAppInitializer() ([aa2fbb75](https://github.com/dereekb/dbx-components/commit/aa2fbb75cfe48b2926014c25ffee5a105c3c3445))
- build fixes ([4f5fca42](https://github.com/dereekb/dbx-components/commit/4f5fca423437749ba0882e0983108bb85997f0e5))
- bump ng-forge version ([da7e4e70](https://github.com/dereekb/dbx-components/commit/da7e4e7060f960ab37ce45b1f360875fd09376b9))
- bump nx version, angular version ([913815fa](https://github.com/dereekb/dbx-components/commit/913815faaeb054396f1e019829b7604c8bedd7d9))
- button echo fixes and demo updates ([701eabc1](https://github.com/dereekb/dbx-components/commit/701eabc1fc0d4cb75ce67dee215634ef7a0fc7e9))
- button spinner color and interaction fixes ([5d69550c](https://github.com/dereekb/dbx-components/commit/5d69550c1616f83d40aeb760c77de7261d4e647b))
- calendar style fixes ([7937d409](https://github.com/dereekb/dbx-components/commit/7937d40927d1315e98e1f54ac8c40370617364d1))
- callCloudFunction() now converts the params to a POJO ([a895308f](https://github.com/dereekb/dbx-components/commit/a895308f01454b7c4e8c491dce08583525d2c9fe))
- changed DbxActionLogger console output ([e3d99605](https://github.com/dereekb/dbx-components/commit/e3d996057323131cd683aa9011de3cd433c8343f))
- changed dbxListItemField content height css ([41688f59](https://github.com/dereekb/dbx-components/commit/41688f59ba78992aaf75aebde2f611b1c5da01ac))
- changed default task notification key ([cbcd7173](https://github.com/dereekb/dbx-components/commit/cbcd7173707d2f272e4eaa1b740317f5d8620151))
- chip interfaces extend LabeledValue ([097c4479](https://github.com/dereekb/dbx-components/commit/097c447910239b6c0449cbb5bfef3300c64bfa24))
- circleci cache fix ([6c0390dc](https://github.com/dereekb/dbx-components/commit/6c0390dcce6dbc034e01a99ea8a022f21f45a14c))
- circular dependency fix ([57831f42](https://github.com/dereekb/dbx-components/commit/57831f42bb1eed905e9c6e8f3412be3d69b8b989))
- cleanup ([9e06519d](https://github.com/dereekb/dbx-components/commit/9e06519d18a86774e1a8858990909316afc5cef6))
- completed dbxActionAnalytics ([9af0947f](https://github.com/dereekb/dbx-components/commit/9af0947f7d9f4045a208ded0015861c74ecd8263))
- completed useDefineForClassFields changes ([517376c9](https://github.com/dereekb/dbx-components/commit/517376c9436e422297d1be366c72f4583cf32d71))
- constraint templates typing refactor ([18839637](https://github.com/dereekb/dbx-components/commit/188396379ec98db24dcef75f6d6821f0d7bab0ec))
- convention fixes for dbx-core and dbx-web ([5e514368](https://github.com/dereekb/dbx-components/commit/5e514368fc44e00df9db5efed837d46bd888bca8))
- convention fixes for zoom and zoho packages ([bd43391d](https://github.com/dereekb/dbx-components/commit/bd43391d87216fb74bad02373d7afe1a5bdb92f7))
- convertMailgunTemplateEmailRequestToMailgunMessageData() fix ([68f0a413](https://github.com/dereekb/dbx-components/commit/68f0a41381a6244f4d234cea50735bacc30f63ce))
- countDocs() test fix ([f4bc49aa](https://github.com/dereekb/dbx-components/commit/f4bc49aaaf1ba67d2db0c07f10e1fd3f1cedb3e6))
- css fixes ([8cf26921](https://github.com/dereekb/dbx-components/commit/8cf26921e2ba72c12b2da64328a3280d09c680c3))
- css fixes ([d95cd94c](https://github.com/dereekb/dbx-components/commit/d95cd94cc91482b30dcc40e446ba4173f4009cf3))
- date block test fix ([4a44cc7d](https://github.com/dereekb/dbx-components/commit/4a44cc7d643d2999c618d43e99d902d72013bcde))
- date refactoring ([e86d9497](https://github.com/dereekb/dbx-components/commit/e86d94973ffef8e9a6eb179ef403f0a8f40772ea))
- dateCellTiming() fixes ([b2a41a35](https://github.com/dereekb/dbx-components/commit/b2a41a351aa1750d5c21074b3c319173fd48178a))
- dateRangeField, dateTimeRangeField valueMode fix ([175c9b5a](https://github.com/dereekb/dbx-components/commit/175c9b5a0fa94a61a3e05892582d2483754cde7f))
- dateTimeField's timeDate can now reference another field ([1628f259](https://github.com/dereekb/dbx-components/commit/1628f259c603ffc46b2a8606bfcf18e7ea90cc58))
- dateTimeField() improvements ([888737cc](https://github.com/dereekb/dbx-components/commit/888737cc2a8fabd99374aa5753e446c4a629c903))
- dateTimeField() resyncs time string when focus is lost ([6076ec85](https://github.com/dereekb/dbx-components/commit/6076ec8532034aa1b39cd70c11019a6083c681ba))
- dateTimePicker() fix ([4ab55b71](https://github.com/dereekb/dbx-components/commit/4ab55b715df41c3b0201d4cc0d10967ddf8214d2))
- **dbx-analytics:** added prefixes to all analytics related classes ([5db960f0](https://github.com/dereekb/dbx-components/commit/5db960f0409ff0380b937257b3c9ffc3e9d362d3))
- dbx-anchor fix ([48ec9307](https://github.com/dereekb/dbx-components/commit/48ec9307103e5b88993c89dbfeaed07b2b40a94e))
- dbx-bg fix ([0429a41e](https://github.com/dereekb/dbx-components/commit/0429a41ecb5ba0f0d95e36e6e33b09c3fcbd53d5))
- dbx-button in dbx-anchor fix ([b11a4364](https://github.com/dereekb/dbx-components/commit/b11a43649ea59d781d921971fc20a594596d10fc))
- dbx-button-wrap-group supports dbx-anchor ([e43922be](https://github.com/dereekb/dbx-components/commit/e43922be7e5d5d8a3c0cdb0bd4ce39f0b3dbe6b7))
- dbx-cli manifest commands under model parent ([df534037](https://github.com/dereekb/dbx-components/commit/df5340372ebb69e1b105496e36614cef13b6b2b0))
- dbx-components-mcp css-utility cluster ([cc32399e](https://github.com/dereekb/dbx-components/commit/cc32399e6a99a7b052b507507c558bf26da9396a))
- dbx-components-mcp improvements ([b75a0f6c](https://github.com/dereekb/dbx-components/commit/b75a0f6c3b85151936be535657291f48f6e48962))
- **dbx-components-mcp:** added css-token-lookup, ui-smell-check ([719f3c76](https://github.com/dereekb/dbx-components/commit/719f3c76f00a23ede9b26e78d50f6f54ceb53fff))
- **dbx-components-mcp:** added dbx_mcp_config tool ([f2e5658c](https://github.com/dereekb/dbx-components/commit/f2e5658c1fa96b243fb2cfbdbbe21b6b7a34018c))
- **dbx-components-mcp:** added dbx_model_api_* tool cluster ([68a7b368](https://github.com/dereekb/dbx-components/commit/68a7b368d1a1035d63a55882e54bd618495c73ee))
- **dbx-components-mcp:** added dbxDocsUiExamples cluster ([1aff5b89](https://github.com/dereekb/dbx-components/commit/1aff5b892096171e4cd07c31fe04fc3d3790e7fe))
- **dbx-components-mcp:** added downstream model search/lookup ([63ea1065](https://github.com/dereekb/dbx-components/commit/63ea1065b7234cb04c5322e5abeaa139c5c8a97f))
- **dbx-components-mcp:** added fields filter to model lookup ([2b1cbd97](https://github.com/dereekb/dbx-components/commit/2b1cbd974737495ed116a4102046d1d8df02029a))
- **dbx-components-mcp:** added FirestoreCollectionKind taxonomy ([9db2bb7c](https://github.com/dereekb/dbx-components/commit/9db2bb7cf865f32feae779bc368745d1f788f048))
- **dbx-components-mcp:** added model test tree/search tools ([9787c159](https://github.com/dereekb/dbx-components/commit/9787c1591f6b72709331d8750a6d6e2e6c24a9d3))
- **dbx-components-mcp:** added model-fixture tools ([809dfcce](https://github.com/dereekb/dbx-components/commit/809dfccec8d62bd7ad160d481d55c5c5f10d8a2e))
- **dbx-components-mcp:** added untagged model rules to validator ([51d64104](https://github.com/dereekb/dbx-components/commit/51d641045c8c1c6a3f939a2f8fe81bb84041185b))
- **dbx-components-mcp:** clarified @dbxModelVariable guidance ([58be05f0](https://github.com/dereekb/dbx-components/commit/58be05f0e318b16261f0a4bdf17b620f3bf632e5))
- **dbx-components-mcp:** drop sourcePath/sourceLocation ([d2d2d501](https://github.com/dereekb/dbx-components/commit/d2d2d501984f1ba5ba41ad5aa9fab2e003d9ebd0))
- **dbx-components-mcp:** improve ui-smell-check output ([b21f1dcb](https://github.com/dereekb/dbx-components/commit/b21f1dcbecb6da30c705700de682f45c23926b91))
- **dbx-components-mcp:** recognize itShould* as it ([76d9919f](https://github.com/dereekb/dbx-components/commit/76d9919f01e3d0788a6c6297f52b3abb8e954952))
- **dbx-components-mcp:** resolved sonarqube findings ([b833e7ed](https://github.com/dereekb/dbx-components/commit/b833e7ed333799936f7594aaaa9a02f4f9ed8782)), closes [String#match](https://github.com/dereekb/String/issues/match)
- **dbx-components-mcp:** sonar issue cleanup ([cc865449](https://github.com/dereekb/dbx-components/commit/cc86544987184145fc5a8004006140b00f1a066d)), closes [Array#push](https://github.com/dereekb/Array/issues/push)
- **dbx-components-mcp:** tune ui-smell-check from demo ([fbc14858](https://github.com/dereekb/dbx-components/commit/fbc148581db01be68639851a5af49ed6042f0742))
- dbx-flex-group styling ([5634a14f](https://github.com/dereekb/dbx-components/commit/5634a14f9fcbc691c4cced8db3ae7a6584ce6271))
- dbx-form-search-form style fixes ([7de2b9c6](https://github.com/dereekb/dbx-components/commit/7de2b9c6a3ceb843555b854b35466ded982bedbb))
- **dbx-form:** clickable box for forge checkbox/toggle ([c6381812](https://github.com/dereekb/dbx-components/commit/c638181212138f9e7ed4d2d87ae1570db4dc82b4))
- **dbx-form:** dbxForgeFlexLayout takes config object ([894a8286](https://github.com/dereekb/dbx-components/commit/894a82861da44651f782abf377ed46acb4bb0727))
- **dbx-form:** forge preset mat-input styles ([52e3bcfb](https://github.com/dereekb/dbx-components/commit/52e3bcfbcaed83b20ca11104dbcbb24ad3fc4e1a))
- dbx-list-view-group header styling fix ([29c6338c](https://github.com/dereekb/dbx-components/commit/29c6338cdcdca9d3a37c0bad66cf1f458d66e83c))
- dbx-pdf-merge-editor slot uploaders + validator ([45287d42](https://github.com/dereekb/dbx-components/commit/45287d42830a0ace6437c270b74cb690c866f063))
- dbx-schedule-selection styling fixes ([4961019f](https://github.com/dereekb/dbx-components/commit/4961019f4108ac4f95b5c9fc77d1f6c82dd89444))
- dbx-schedule-selection-calendar css fix ([f1290d78](https://github.com/dereekb/dbx-components/commit/f1290d7881716cfeb448fd2b124197531789e30a))
- dbx-table fix ([c250b08d](https://github.com/dereekb/dbx-components/commit/c250b08d51616f4956eeeda745314800e1f9143b))
- dbx-table-column-size fix ([3e8a2212](https://github.com/dereekb/dbx-components/commit/3e8a2212fbed85fc5784fbf4b7bc6a3c26e3c0a9))
- dbx-two-column-head padding fix ([a0167637](https://github.com/dereekb/dbx-components/commit/a0167637fde2836ce9d762149453ba340fd4cfa4))
- dbx-us-address spacing fix ([dae66f0f](https://github.com/dereekb/dbx-components/commit/dae66f0f830465f3aa9a65ad3377847f8c647f6b))
- dbx-us-address spacing fix ([1e9454e4](https://github.com/dereekb/dbx-components/commit/1e9454e4e2b9062441f7b95fcbc159b0d2e63f1b))
- **dbx-web:** added pdf merge editor extension ([27370932](https://github.com/dereekb/dbx-components/commit/2737093271710c00333d1834a0bba2ba335b2992))
- dbxFirebaseCollectionChangeTrigger() name fix ([3c7b032a](https://github.com/dereekb/dbx-components/commit/3c7b032a1bb54d134d8e2324594f68f2aa4edf17))
- dbxFirebaseCollectionChangeWatcherInstance type improvements ([40bdd927](https://github.com/dereekb/dbx-components/commit/40bdd9278df5dc8443881099bcd224dea0c2adb5))
- dbxFormComponentFieldComponent refactor ([b6fa656e](https://github.com/dereekb/dbx-components/commit/b6fa656ec9801c80dcad89886fb99e8c99c2bcdc))
- dbxSnackbar refactor ([80684aa0](https://github.com/dereekb/dbx-components/commit/80684aa08f4bffa7b1f852a87b6200a6cc85f603))
- dedupe api.ts crud extractor ([fa1d5aa0](https://github.com/dereekb/dbx-components/commit/fa1d5aa06c488c1b9b8b963e71c11cfba792aa7d))
- demo fixes ([cd115914](https://github.com/dereekb/dbx-components/commit/cd115914697a1ff2bc257b03d6f52950c1d27144))
- demo update, deprecated directives removal ([258e4f86](https://github.com/dereekb/dbx-components/commit/258e4f865c5d43a6457cdffa9794dc4c8090f59c))
- dependency fixes ([9d4f8a2a](https://github.com/dereekb/dbx-components/commit/9d4f8a2aebfb8a09b431071743152f868affddbe))
- dependency updates ([d8e32eff](https://github.com/dereekb/dbx-components/commit/d8e32eff9040a679303c29b9b881477be49f14d8))
- dependency updates ([77b623ac](https://github.com/dereekb/dbx-components/commit/77b623ac0ef14d114f7da4d7d7d55062bdcc3923))
- derive cli skip-command set from grouped arrays ([e9928f7e](https://github.com/dereekb/dbx-components/commit/e9928f7e96ba98b39f895c8e3d9c6aa3f20a7fda))
- detect projected content for icon-only buttons ([add74404](https://github.com/dereekb/dbx-components/commit/add74404575aeb9c7178cd6f38adfd95de8ae4a6))
- disable sync fail on issue ([91e001c6](https://github.com/dereekb/dbx-components/commit/91e001c67ede40db5309a2fcd4a66c93ebd317d6))
- distinctUntilHasDifferentValues() type fix ([a10e9549](https://github.com/dereekb/dbx-components/commit/a10e954965b4acabd96622ae39a41d067de22b33))
- downgrade @commitlint/cli ([e6dc3fa2](https://github.com/dereekb/dbx-components/commit/e6dc3fa2a6e390a5c0ef1fa00e6d57ccef3cf979))
- enriched firebase-lookup model output ([efccc35f](https://github.com/dereekb/dbx-components/commit/efccc35fd7ffb5fead6184dd257120aa69881a5b))
- export fix ([739bb0ca](https://github.com/dereekb/dbx-components/commit/739bb0ca9eb350cc104a44c8d8fed6a9a32fdc48))
- exported download multiple files min/max constants ([84195b16](https://github.com/dereekb/dbx-components/commit/84195b1687cc72297648d9f66878cdf37a9b8432))
- exported set.delta ([a1f6282a](https://github.com/dereekb/dbx-components/commit/a1f6282a5696e81c385c486e0afca377974deeba))
- exposed firebaseServerValidationError() ([85403b14](https://github.com/dereekb/dbx-components/commit/85403b141f27478b127eb28f7b01e968e9eea4a0))
- extensions material outline appearance ([32dc070f](https://github.com/dereekb/dbx-components/commit/32dc070f3a1235cdc791abb3e354e632e012e89a))
- firebase dependencies bump ([8968a192](https://github.com/dereekb/dbx-components/commit/8968a1926e04304b1dcd33a35cbc52ccd03ede6b))
- firebase dependency updates ([6e8e9f99](https://github.com/dereekb/dbx-components/commit/6e8e9f9984b14be461444ab066382031ee7dfde3))
- firebase readonly type updates ([83876382](https://github.com/dereekb/dbx-components/commit/838763822965288b4553fb928f0c5abad3de94df))
- firebase, firebase-server conventions fixes ([8d9e0514](https://github.com/dereekb/dbx-components/commit/8d9e05142a317eb8b657cb04aa1333c80b82b9f0))
- firebaseServerErrorInfo() ([06635197](https://github.com/dereekb/dbx-components/commit/0663519796f923029e06c47d6ea1f632e8965f44))
- firestore accessor update() parity ([bb97c635](https://github.com/dereekb/dbx-components/commit/bb97c6358523fff5abfde119f98c38809c6ce8d2))
- firestoreField() now uses asObjectCopyFactory() ([3fe2cc57](https://github.com/dereekb/dbx-components/commit/3fe2cc5772965c21c455cbc3c2289065d95fcd46))
- firestoreNumber() has an optional typing ([e119de87](https://github.com/dereekb/dbx-components/commit/e119de87dcb44ea5323a7d33c37fd40aaaf2e6ab))
- firestoreObjectArray() can now accept firestoreField ([ffb8f452](https://github.com/dereekb/dbx-components/commit/ffb8f45288c9a99cdda1d3acb7d91e1a33db38bc))
- firestoreTimezoneString() typing fix ([8d153979](https://github.com/dereekb/dbx-components/commit/8d1539796795ec95293898b0499d90c05355737b))
- fix anchor selection misfire ([05957475](https://github.com/dereekb/dbx-components/commit/05957475167d534df86ad9d765bdb0f8d0f53b81))
- fix maximum notification task tries ([da88665a](https://github.com/dereekb/dbx-components/commit/da88665abee5282b8cc5ecaf1b97fb37afc25229))
- fixed AbstractSystemStateDocumentStoreAccessor ([f5bf2673](https://github.com/dereekb/dbx-components/commit/f5bf2673e125a60f3537752e7a4c2c5c1dfa416b))
- fixed accidental export ([d7941836](https://github.com/dereekb/dbx-components/commit/d79418361a32148c515afdf6dbb2886c8385b104))
- fixed anchor list active styling ([fd64b889](https://github.com/dereekb/dbx-components/commit/fd64b88996ce64d345e655d8fd57ca47e2511fe8))
- fixed assertSnapshotData typing for easier use ([8a292e41](https://github.com/dereekb/dbx-components/commit/8a292e419518f978d481532da60cf80e5197ae3b))
- fixed bar button echo and icon positioning ([d96de6d2](https://github.com/dereekb/dbx-components/commit/d96de6d26ba98f54d7f1c8f72dda3381a2e7001c))
- fixed build error ([349be9e3](https://github.com/dereekb/dbx-components/commit/349be9e3d8b67437f809dc6e318742b1ff6cf44b))
- fixed build issue ([c7f88d34](https://github.com/dereekb/dbx-components/commit/c7f88d34a8aed9d2b21db3cbfe5da6e181d7bdfd))
- fixed CalendarScheduleSelectionStore range crashing ([5f8ddf98](https://github.com/dereekb/dbx-components/commit/5f8ddf9844306044d5c1be2847b36e980c42a8dc))
- fixed change detection in dbx-table ([d444140c](https://github.com/dereekb/dbx-components/commit/d444140cd4a3642349791d89ea2dfa63e78cfdcf))
- fixed collectionForDocument input ([1bd78976](https://github.com/dereekb/dbx-components/commit/1bd789769f0ab90a6772f4d6bfc3112264074b78))
- fixed combineLoadingStatesStatus() ([d9e44b7f](https://github.com/dereekb/dbx-components/commit/d9e44b7fec4c4cc0f14e85ba088cf3b5ea45db11))
- fixed createNotificationTemplate() ([85d584ea](https://github.com/dereekb/dbx-components/commit/85d584eafc6ac6ef096ce1effcab8f516c5bef35))
- fixed crm tests ([9d22fb92](https://github.com/dereekb/dbx-components/commit/9d22fb92609c8f0e81d3ec5fb0a3ef243784b542))
- fixed custom panel class for DbxPopoverConfig ([383dd197](https://github.com/dereekb/dbx-components/commit/383dd197a9e91c405b62173c69e35bdcb2f2073e))
- fixed date/time input button css ([e2d3a070](https://github.com/dereekb/dbx-components/commit/e2d3a0700f127a2ad4ebe2ed46fa14fb914a83fd))
- fixed dateBlockDayTimingInfoFactory() ([a5966beb](https://github.com/dereekb/dbx-components/commit/a5966beb9cf908388d55c4af55cf3fdfb60fe5e9))
- fixed dateBlockDayTimingInfoFactory() ([c83ec11b](https://github.com/dereekb/dbx-components/commit/c83ec11b168a0cd6872faec0c2305f74369589ad))
- fixed dateBlockDurationSpan hasStarted/Ended functions ([1487566e](https://github.com/dereekb/dbx-components/commit/1487566e750497a92a4ccb5ea2558a84c739cfb2))
- fixed dateBlockTimingDateFactory() ([7b609600](https://github.com/dereekb/dbx-components/commit/7b609600ad5382d705a69e310833e2a20ee912f5))
- fixed dateCellDayTimingInfoFactory() case ([01b5d526](https://github.com/dereekb/dbx-components/commit/01b5d526946a53c5a8c92b21a2f6a700a58ee847))
- fixed dateDistance pipe output ([4a02f39a](https://github.com/dereekb/dbx-components/commit/4a02f39a90eee59d51cd47ac03598f73193965c8))
- fixed dateTimePicker disabled state ([566dea52](https://github.com/dereekb/dbx-components/commit/566dea52f920f1601a4badd843cefea48cda68a8))
- fixed DateTimingRelativeIndexFactory name ([e3d0237d](https://github.com/dereekb/dbx-components/commit/e3d0237d5e9a898bf03d8a39926cc78355b750ee))
- fixed dbx-anchor with onClick and nested dbx-button ([4b9fcaf9](https://github.com/dereekb/dbx-components/commit/4b9fcaf988118e932dcc096321d8b85c0873a1a6))
- fixed dbx-m0 ([ad218d55](https://github.com/dereekb/dbx-components/commit/ad218d55fbc66b548f1f04260063b7c4ac6db177))
- fixed dbx-section-header-padded css ([496b8cc9](https://github.com/dereekb/dbx-components/commit/496b8cc91298e8cbfff97bc5ad608e44d63b1581))
- fixed DbxAnalyticsService user clearing ([818d6800](https://github.com/dereekb/dbx-components/commit/818d68005efa0786422dfa26088c439a4faf9fb1))
- fixed DbxAnchorLinkComponent anchor input type ([6c5dd2ea](https://github.com/dereekb/dbx-components/commit/6c5dd2eae5c01d6e4361f7a0c12a8afc61219341))
- fixed DbxCalendarScheduleSelectionStore timezone output ([a7c9ecc8](https://github.com/dereekb/dbx-components/commit/a7c9ecc894327adfb383562b0024106a3c724602))
- fixed DbxFirebaseDocumentStoreDirective ([b1c11efc](https://github.com/dereekb/dbx-components/commit/b1c11efcb98e1429d295448c0231b1cbbd8f040e))
- fixed DbxFirebaseDocumentStoreDirective ([6b6b74d9](https://github.com/dereekb/dbx-components/commit/6b6b74d9d3675ecbf83b180ce6d5e5b5e19615ff))
- fixed DbxMapboxMapDirective ([c6ef917f](https://github.com/dereekb/dbx-components/commit/c6ef917f45fdc3e4f27600253d994577bf3026eb))
- fixed DbxMapboxMapStore ([a1f85f35](https://github.com/dereekb/dbx-components/commit/a1f85f357ad88d334786e3c7d0af440c9c98325b))
- fixed dbxTwoColumn related names ([728f8cc6](https://github.com/dereekb/dbx-components/commit/728f8cc63efc8d86b5cf66f9e495e81f38f0e1ef))
- fixed early destroy on components ([a5f3a4c3](https://github.com/dereekb/dbx-components/commit/a5f3a4c3fbe585a8d95b03f635966c7ed7107813))
- fixed eslint.config.library type import fixing ([0a64acab](https://github.com/dereekb/dbx-components/commit/0a64acab017e6352b4e14a5ee37a4773dd399521))
- fixed expandDateScheduleRange() for a specific scenario ([1e9f6852](https://github.com/dereekb/dbx-components/commit/1e9f6852ac32d222cab361da76fc28a97834c71f))
- fixed expandUniqueDateBlocks() ([7b4ae0bb](https://github.com/dereekb/dbx-components/commit/7b4ae0bb1c39bd6cd110024b38086c6b011c3b14))
- fixed ExponentialPromiseRateLimiter wait times ([27725dc8](https://github.com/dereekb/dbx-components/commit/27725dc8015ea20ab379ad565cda3fe0cc039c8c))
- fixed extract manifest warnings ([b1ee475c](https://github.com/dereekb/dbx-components/commit/b1ee475ceb93ee9be1311a9eadee9e89d091a348))
- fixed filterUnique for optionalFirestoreArray ([bb046b49](https://github.com/dereekb/dbx-components/commit/bb046b491314229ec9f4e3b0d2183a5ba19611c6))
- fixed firestoreObjectArray() sub object issue ([d96e696e](https://github.com/dereekb/dbx-components/commit/d96e696ea44ef3b70de02ef7b07e2f332970f6fb))
- fixed firestoreUniqueArray() typing change ([643c1c6a](https://github.com/dereekb/dbx-components/commit/643c1c6a58c59428b5b52f2ff0def9d0255e866c))
- fixed formatting of firebase nest validation error ([f5e34872](https://github.com/dereekb/dbx-components/commit/f5e348729d4fb26d9b684dc4e4d8a7097a16a3eb))
- fixed fullDateCellScheduleRange() scenario ([dd7c2a5f](https://github.com/dereekb/dbx-components/commit/dd7c2a5f72f316f3e5caa8f815d8a5c398eac609))
- fixed hint on DbxScheduleSelectionCalendarDateRangeComponent ([ec93f82b](https://github.com/dereekb/dbx-components/commit/ec93f82b533eca6086f2e9410e4621b77a76177b))
- fixed incorrect typing change in DateBlockDayTimingInfo ([7a38cd11](https://github.com/dereekb/dbx-components/commit/7a38cd110e340cd3102ea6d8925371dc149f787e))
- fixed issue where formly disable was not always working ([d194f615](https://github.com/dereekb/dbx-components/commit/d194f6156766bd746504f8890893525bcb58b193))
- fixed issue where scanBuildArray() did not return a new array ([0ea19975](https://github.com/dereekb/dbx-components/commit/0ea199750cb858d44eb6806a4133e4e179cda9da))
- fixed issue with calculateTimezoneOffset ([5ef68c7c](https://github.com/dereekb/dbx-components/commit/5ef68c7ceb45fb1aa018fe9624cf5aa864f41a83))
- fixed issue with nest app startup ([73f97cbe](https://github.com/dereekb/dbx-components/commit/73f97cbe9ed1f6f98d9ca94d8e9e4f5427be8d06))
- fixed isThrottled ([57cc336a](https://github.com/dereekb/dbx-components/commit/57cc336a4c70e0e3a144c6f7b061b8244e411977))
- fixed list component's empty loading state show logic ([93b7d518](https://github.com/dereekb/dbx-components/commit/93b7d5182bb0f6d6c4e40ed61d07f320845e99ac))
- fixed lock file ([61d38a21](https://github.com/dereekb/dbx-components/commit/61d38a211a9bfdb20f316a583c4dc4c1a5a42f32))
- fixed makeMetaFilterSearchableFieldValueDisplayFn() ([9e5c82af](https://github.com/dereekb/dbx-components/commit/9e5c82af9d31e1f02316b5427d1682790253e08b))
- fixed mapbox virtual sizing ([995d3d9f](https://github.com/dereekb/dbx-components/commit/995d3d9fdd425a3af5245f8d2d8e2ae6f498ad16))
- fixed mispelling ([9bb519b7](https://github.com/dereekb/dbx-components/commit/9bb519b792e1f3f47c17a10dc25a4d7ca613f83f))
- fixed missing export ([1ebb8486](https://github.com/dereekb/dbx-components/commit/1ebb848644a611d23d91a8efb313b2ed5a3ee1c7))
- fixed missing ServerEnvironmentService providers ([a982cb75](https://github.com/dereekb/dbx-components/commit/a982cb75b2c8cccad4d86587c69a8f4b5dc0bd36))
- fixed optionalFirestoreDate() and tests ([79ed25d8](https://github.com/dereekb/dbx-components/commit/79ed25d8a5667cf81539b74d19f4c36a75c5a2f1))
- fixed PrimativeKeyDencoderMap names ([1044a825](https://github.com/dereekb/dbx-components/commit/1044a825fe9271cc3897c68735e1018755422170))
- fixed randomFromArrayFactory() rolls ([379c76d1](https://github.com/dereekb/dbx-components/commit/379c76d1fe7f33dbc4a89764f2b185595ed89750))
- fixed rateLimitedFetchHandler() error ([aa06e7f7](https://github.com/dereekb/dbx-components/commit/aa06e7f7fc420d83724440804456a4571269057b))
- fixed regression in flattenAccumulatorResultItemArray() ([0d75830c](https://github.com/dereekb/dbx-components/commit/0d75830cd5bfad6847d6a0dd07912242312e5b3b))
- fixed release, sync'd package deps ([ee13cfb8](https://github.com/dereekb/dbx-components/commit/ee13cfb8bb3fa89a52adb09eb9e15014f9024155))
- fixed rootSingleItemFirestoreCollection() return type ([6afcb104](https://github.com/dereekb/dbx-components/commit/6afcb1048bedbbbb4d7a5e8edb0d36cad877422a))
- fixed rounding on calculateTimezoneOffset() ([8087de6f](https://github.com/dereekb/dbx-components/commit/8087de6f57b36a6b4fc9730cdcd825ed816e9d74))
- fixed section styling ([1e294ec2](https://github.com/dereekb/dbx-components/commit/1e294ec25c5182ecd4846a1ad3c9d2c768eb7c73))
- fixed selection doc ([a887d7da](https://github.com/dereekb/dbx-components/commit/a887d7dac8a4c99214889b6eaf35b30e594161f6))
- fixed setContainsAnyValue() regression ([bae94253](https://github.com/dereekb/dbx-components/commit/bae9425311d02793ec2185a253e64d953d316644))
- fixed SetDeltaChangeKeys type ([016a3d4b](https://github.com/dereekb/dbx-components/commit/016a3d4b3b6081ef74c7c5bf11faf7500d3688d7))
- fixed setup script ([35ff2738](https://github.com/dereekb/dbx-components/commit/35ff2738e48d394005918644de2967e7f4d4a7d0))
- fixed SplitStringTree typings, bug ([cafcbfaf](https://github.com/dereekb/dbx-components/commit/cafcbfafc68caadb7ef5273e675a7475c4df8b76))
- fixed storageFileUploadFiles() error handling ([a0221132](https://github.com/dereekb/dbx-components/commit/a02211321f4e6d8e23f1ee6679f2cde77d2a3f24))
- fixed StringConcatenation spelling issue ([162e3792](https://github.com/dereekb/dbx-components/commit/162e37926e027275cabef8767a664c84386e411b))
- fixed tonal color system regressions ([de3eef66](https://github.com/dereekb/dbx-components/commit/de3eef66aab9c464d11e78c36d6085f4dee7c562))
- fixed unintentional renaming of dbx-form component ([84a76c89](https://github.com/dereekb/dbx-components/commit/84a76c899990eb01aa9bd0927e9cc118e5b46687))
- fixed vitest automatic isolate ([a0b5fd31](https://github.com/dereekb/dbx-components/commit/a0b5fd313c95db6191b7eb888f50abbbfec8f8dc))
- fixedDateRange() fix ([7c3ebf35](https://github.com/dereekb/dbx-components/commit/7c3ebf35fc54b0db8da9a1651989d10182944514))
- fixes ([3526e6a0](https://github.com/dereekb/dbx-components/commit/3526e6a065646960aca531bb7380b3d737afdcaf))
- fixes ([0eb0ef3a](https://github.com/dereekb/dbx-components/commit/0eb0ef3a8870fa2d85fbf64b77c35f0bc1f37573))
- fixes ([7806860a](https://github.com/dereekb/dbx-components/commit/7806860a5b5cd4fc8c8fa241973937bc80c1c486))
- fixes ([716fb806](https://github.com/dereekb/dbx-components/commit/716fb806f5d968060a705a96d372604d96485a68))
- fixes ([f6be81e2](https://github.com/dereekb/dbx-components/commit/f6be81e2f3d1e5064a5a383951695ee6cdce43f5))
- fixes ([bab2c028](https://github.com/dereekb/dbx-components/commit/bab2c028d575ab14533819059ff505ed9f2b0dab))
- fixes and style additions ([820d8a4c](https://github.com/dereekb/dbx-components/commit/820d8a4c1b6caa0aa46c2a0cdfc16af7f6e17637))
- fixes, disable snyk ([978142bf](https://github.com/dereekb/dbx-components/commit/978142bf3a50f927be8e9430734cbcd7e950342f))
- flaky test fix ([bd2e8e71](https://github.com/dereekb/dbx-components/commit/bd2e8e71b4797d5effec600a194c4d3835a81cfc))
- flat accordion view with stickyHeaders config ([5f813813](https://github.com/dereekb/dbx-components/commit/5f813813aafc3826fce50ffd287fa326de54485b))
- form fixes ([977e012b](https://github.com/dereekb/dbx-components/commit/977e012b471fa24b1fdcb0ea04331f71a61d174e))
- getDateBlockTimingHoursInEvent() now returns fractional hours ([1ed425ac](https://github.com/dereekb/dbx-components/commit/1ed425ac4f28b2897fb7fe541eafb51e38c0ae1a))
- hide toggle dark theme when demo is visible ([96cf5183](https://github.com/dereekb/dbx-components/commit/96cf518383919c9ee4a107855d5aa367036f65d0))
- import cleanup ([e6745a98](https://github.com/dereekb/dbx-components/commit/e6745a983bede21a8a22ecaf0b77bf7fcf3da6f5))
- import fixes ([8c0ac289](https://github.com/dereekb/dbx-components/commit/8c0ac289f039d4f78b1ccebb510383b1cc858708))
- import from common firebase instead of @firebase ([3405a24f](https://github.com/dereekb/dbx-components/commit/3405a24f20b4d819e299ad9076d2b68a734540bd))
- improve forge source select and pickable list fields ([b8162199](https://github.com/dereekb/dbx-components/commit/b8162199573fed6a4301c4dbe4112c5ca969451f))
- improved dateCellRangeOfTiming() ([fe8a8587](https://github.com/dereekb/dbx-components/commit/fe8a8587f2a91071d99f896a4ad5cdf4f6417a1e))
- improved dateRange() ([edf68caf](https://github.com/dereekb/dbx-components/commit/edf68caf4385b2bd066b858849e516a81ddc6aab))
- improved dateScheduleRangeField() selection ([8e76547e](https://github.com/dereekb/dbx-components/commit/8e76547eb1ee00491583b8da86fa883db8926635))
- improved datetime field spacing ([9b7e3177](https://github.com/dereekb/dbx-components/commit/9b7e317793d12a78189356d51cf8caea3d639e82))
- improved dateTimeField() error handling ([a11be01c](https://github.com/dereekb/dbx-components/commit/a11be01ce35f9e73c286729ac614f9d5cc19e684))
- improved dbx-button icon-only styling ([f4b04c47](https://github.com/dereekb/dbx-components/commit/f4b04c477d98533fca17c607d201a71062960153))
- improved dbx-dialog-content-close styling ([639e019b](https://github.com/dereekb/dbx-components/commit/639e019b9daea45a89c7326aa1a80607b0913c26))
- improved dbx-schedule-selection-calendar initial month ([c56b49e0](https://github.com/dereekb/dbx-components/commit/c56b49e0c51b8950a3e2cb0f8504a81bde8da354))
- improved exponentialPromiseRateLimiter() ([d8be419d](https://github.com/dereekb/dbx-components/commit/d8be419d10539d4b2d0f4f3d4ce7cb8bd560b906))
- improved fixedDateRangeField() active date selection ([0c91ded3](https://github.com/dereekb/dbx-components/commit/0c91ded31bf91d73f5f4c3e6349d14548ecf882b))
- improved input type in timeHasExpired() ([0ade61cf](https://github.com/dereekb/dbx-components/commit/0ade61cfc6fe1cbc95937dd1051d1081ea799ca8))
- improved IterateFirestoreDocumentSnapshotsConfig typing ([79541c21](https://github.com/dereekb/dbx-components/commit/79541c21d214690c1af0c5bcdee4c0df2d1773fa))
- improved normal DbxFixedDateRangeSelectionMode ([ae168c6a](https://github.com/dereekb/dbx-components/commit/ae168c6a7eb6a80eb18a3523755168cd395356e6))
- improved parseISO8601DayStringToDate() parsing ([1fd037e1](https://github.com/dereekb/dbx-components/commit/1fd037e197d702169d2a3c88927b105ef802528c))
- improved searchable fields ([b4925874](https://github.com/dereekb/dbx-components/commit/b4925874ac4afbfa162729372f5d30ceb48fe279))
- injection and list view improvements ([cbcb8c8f](https://github.com/dereekb/dbx-components/commit/cbcb8c8f61492333635da18e3a0c28aced7c2fe1))
- iterator fixes ([0a08c2af](https://github.com/dereekb/dbx-components/commit/0a08c2af3720846ae45b6437b9cc90de2d6f03d5))
- lint cleanup ([a4d0b3d4](https://github.com/dereekb/dbx-components/commit/a4d0b3d436eab40bcb1a52d76c8b84caade0636d))
- lint fixes ([864e93d6](https://github.com/dereekb/dbx-components/commit/864e93d694ac83a43462afb878a83a0318dee1d5))
- lint fixes ([0f4f22db](https://github.com/dereekb/dbx-components/commit/0f4f22db5e518c9d31d7b081f51521a44de89a1e))
- lint fixes and no-else-return refactoring ([6b88663d](https://github.com/dereekb/dbx-components/commit/6b88663dfbd3929f509a4b337e2592fbfe7bba9d))
- lint-fix ([dd7d218b](https://github.com/dereekb/dbx-components/commit/dd7d218b66fb926a56a67d25f42dcf3407bf9f77))
- lint-fix ([408a532d](https://github.com/dereekb/dbx-components/commit/408a532d5a5e2c7b1ee71092fdbff5c10a73de11))
- lint-fix ([95f023dd](https://github.com/dereekb/dbx-components/commit/95f023ddd2980d78d0f2065fc491e90e9894b970))
- lint-fix ([5cd64869](https://github.com/dereekb/dbx-components/commit/5cd648694652bfde63ab0cd4ea2c171650247ecf))
- lint-fix ([4e50bdfc](https://github.com/dereekb/dbx-components/commit/4e50bdfc7a643a319a5fa957cd02b4998e568ca7))
- lint-fix ([5e10dcd6](https://github.com/dereekb/dbx-components/commit/5e10dcd6d95ddfc3561ef658174b0c5a1a00db2a))
- lint-fix ([3290c579](https://github.com/dereekb/dbx-components/commit/3290c579ae19f0d43aaf8728b192ee40a533b6e7))
- lint-fix ([bf5cd7ce](https://github.com/dereekb/dbx-components/commit/bf5cd7ce848ecd2bc358c8b88d686472fda3d17f))
- lint-fix ([fe07af9a](https://github.com/dereekb/dbx-components/commit/fe07af9ad0ad153baceb84e4f20e4a514bb2c81d))
- lint-fix ([26ff4121](https://github.com/dereekb/dbx-components/commit/26ff4121b4aff6a6e2ead560339a50116805bf51))
- lint-fix ([0a967641](https://github.com/dereekb/dbx-components/commit/0a9676417120f2be09bec9d33df68e1b3d3d5572))
- lint-fix ([22f5f242](https://github.com/dereekb/dbx-components/commit/22f5f2424e149caaab227b456f273efc0f9cb8dd))
- lint-fix ([070f34c2](https://github.com/dereekb/dbx-components/commit/070f34c2df8e5045af39c77eafc755edce816259))
- lint-fix ([575206a8](https://github.com/dereekb/dbx-components/commit/575206a8ceee3269aaaff631853bf3072c0ca40b))
- lint-fix ([14db6394](https://github.com/dereekb/dbx-components/commit/14db63941e4922fdf0eafb2928af8c048ac92f26))
- lint-fix ([a88c9a58](https://github.com/dereekb/dbx-components/commit/a88c9a580490fa9477812e07bb02adf7e1276fc8))
- lint-fix ([159cf677](https://github.com/dereekb/dbx-components/commit/159cf6777009f56c8e9fc1f8891a2bc86ad9b959))
- lint-fix ([f1077d1d](https://github.com/dereekb/dbx-components/commit/f1077d1d8ff67a0c4bfca7fc7bfab0d3bb7c9f2c))
- lint-fix ([4d98e55a](https://github.com/dereekb/dbx-components/commit/4d98e55a7f177bf7a672718ee188e9ef4a3b5a0a))
- lint-fix ([50b09dc8](https://github.com/dereekb/dbx-components/commit/50b09dc8907de951335249fcad654901f44348be))
- lint-fix analytics, browser, dbx-firebase ([07c8f7d9](https://github.com/dereekb/dbx-components/commit/07c8f7d9e988a3b8181f02fc5412c40d8e631399))
- lint-fix firebase-server, dbx-core, dbx-web ([de170163](https://github.com/dereekb/dbx-components/commit/de170163304f0a4317e57cb1a3b22023934f7be4))
- list loading fix ([79323fb5](https://github.com/dereekb/dbx-components/commit/79323fb5fc3f58889ee4413c9cd094b426130d67))
- list-card-items-list paints mat-mdc-list-item directly ([7e7576fb](https://github.com/dereekb/dbx-components/commit/7e7576fb7fa9ed27180c9f509484b90db16e0420))
- loadingStateHasValue now returns true for null ([b411660c](https://github.com/dereekb/dbx-components/commit/b411660c20fe3a529d4b4d43fd41e71bed326027))
- login fix ([90385585](https://github.com/dereekb/dbx-components/commit/90385585b6b4e6619c3ab3cd256eab41746a7d71))
- made mapValuesToItemValues required ([9bbf2298](https://github.com/dereekb/dbx-components/commit/9bbf229856399f96552bac6a3611ad3f33833b69))
- mailgunServiceConfigFactory defaults to sandbox if in test ([010c1f9d](https://github.com/dereekb/dbx-components/commit/010c1f9d8ee4c357da0e8b82694dea72a6fdac70))
- mapLoadingStateValueWithOperator() fixes ([8b55e294](https://github.com/dereekb/dbx-components/commit/8b55e294f074ac00ac8f91d6f82ca0c6d0e004aa))
- mapLoadingStateValueWithOperator() now passes loading properly ([df134f65](https://github.com/dereekb/dbx-components/commit/df134f65beedd348574f29f57397277fda40cd44))
- marked packages sideEffects-free ([11651c19](https://github.com/dereekb/dbx-components/commit/11651c1990bd81fea06ba39d39086f43104899f2))
- material outline appearance ([399e1123](https://github.com/dereekb/dbx-components/commit/399e11235248b8f6d8cf363c14e28eef0b52bbf2))
- minimum input size fix for dateTimePicker() ([2bd8a537](https://github.com/dereekb/dbx-components/commit/2bd8a537232992df17e6bfa06c9165166bfc6531))
- minor styling changes and fixes ([69333f87](https://github.com/dereekb/dbx-components/commit/69333f87ee923ba274e01c7c9d9560af72676aa1))
- misc fixes ([ee820bd5](https://github.com/dereekb/dbx-components/commit/ee820bd5e03e09fa5d7033e3e762e729963e5556))
- model-snapshot-fields mcp tools ([a66d93ad](https://github.com/dereekb/dbx-components/commit/a66d93ad9cefccc82e7ac1a01374f79cdfffcf2c))
- model, analytics, rxjs convention fixes ([c05e4797](https://github.com/dereekb/dbx-components/commit/c05e4797a24d85469576c7090ad1767bd212752a))
- modelFirebaseFunctionMapFactory() maps short specifiers ([dc158e88](https://github.com/dereekb/dbx-components/commit/dc158e88a9eed11c963ec18f5d01dce09c846dc7))
- modelRelationUtility functions can now accept maybe arrays ([54df08db](https://github.com/dereekb/dbx-components/commit/54df08dba63efdb358d102e8bb70141331e2041e))
- moved and renamed HandleActionFunction ([19bc0939](https://github.com/dereekb/dbx-components/commit/19bc09395db089c7732307fed143758fb1b4d094))
- moved arktype types to date.model.ts ([d72d241f](https://github.com/dereekb/dbx-components/commit/d72d241fea628929bdc77202b6bc99c81b519aa2))
- moved callModel OIDC scopes to @dereekb/firebase ([11f50fa9](https://github.com/dereekb/dbx-components/commit/11f50fa9d12c21cb7b8d99da458e49da766281ea))
- moved dbx-calendar to dbx-web/calendar package ([9f2b498a](https://github.com/dereekb/dbx-components/commit/9f2b498a2596c43026cd8fe232ca94ba2b26c50b))
- moved DbxFirebaseCollectionChangeWatcher to own class ([452fa22e](https://github.com/dereekb/dbx-components/commit/452fa22e09d0586db1c0cf48f8bd75c106bf32fd))
- moved demo from packages to apps folder ([b4d4b6b8](https://github.com/dereekb/dbx-components/commit/b4d4b6b8b4c592a261803c0b4f5bbc1edd92ff47))
- moved demo-firebase to components ([4bc56fde](https://github.com/dereekb/dbx-components/commit/4bc56fde595cc1dea858180e2b08368c5a54435a))
- moved FirebaseAuthSetupPassword to @dereekb/firebase ([d5edbeff](https://github.com/dereekb/dbx-components/commit/d5edbeff10274f61423d1095cdd7055a67ae53e6))
- moved observable functions from loading.state.ts ([6ddb5bc9](https://github.com/dereekb/dbx-components/commit/6ddb5bc9adbbfc3079ffe3f80b373d32ae1c77a0))
- moved shared demo components to demo-components ([9f5cafea](https://github.com/dereekb/dbx-components/commit/9f5cafeafab410c1b23a4640bb3a054aa1f81996))
- moved TargetModelParams to @dereekb/firestore ([50e0b57c](https://github.com/dereekb/dbx-components/commit/50e0b57c6f4946c44c9f1741d832d2c510ca997a))
- moved vitest config and setup into @dereekb/vitest ([3958a96c](https://github.com/dereekb/dbx-components/commit/3958a96c2e4d05b7809ed28b6eed58b3a59415e1))
- nestjs convention fixes across all sub-libraries ([2d0c57c3](https://github.com/dereekb/dbx-components/commit/2d0c57c3ac717dff025dc19f3ff3f4656ddaf559))
- nestjs/typeform package build fix ([21db2845](https://github.com/dereekb/dbx-components/commit/21db28457365238fd5f79d934163b8fdbdbd5279))
- ng-forms ([#46](https://github.com/dereekb/dbx-components/issues/46)) ([a16b8bb9](https://github.com/dereekb/dbx-components/commit/a16b8bb9c94e782f71dc9f8d515a0053013efb48)), closes [#46](https://github.com/dereekb/dbx-components/issues/46)
- node_modules fallback for firebase-api-manifest ([aafeeec1](https://github.com/dereekb/dbx-components/commit/aafeeec1da82b96e9f29402f11f4d9a470338f43))
- notification task loop fix ([59388846](https://github.com/dereekb/dbx-components/commit/593888468dafd28e8caa219d798b8494de3db55f))
- nx configuration fix ([4ccfa0bd](https://github.com/dereekb/dbx-components/commit/4ccfa0bdd308e9769ffb7779110f75b0767394b8))
- nx fix for node tests ([f883573a](https://github.com/dereekb/dbx-components/commit/f883573ab4ef6619ffe939d2311cd77999e45286))
- onCall type fixes ([a932f6fa](https://github.com/dereekb/dbx-components/commit/a932f6fa1a426dddd157106b5d874387846587c1))
- onCallSpecifierHandler no longer requires default ([3ce10567](https://github.com/dereekb/dbx-components/commit/3ce10567bd4407fd9a19dc774cadc774e526a1de))
- only call clearInstance() if it is set after the test runs ([7518502d](https://github.com/dereekb/dbx-components/commit/7518502d825aac5f6949081fce78608d555a8135))
- package cleanup ([e68122d1](https://github.com/dereekb/dbx-components/commit/e68122d14bd2daaae15c5d84e0eba15d9c58dc4b))
- package syncing ([214a9a21](https://github.com/dereekb/dbx-components/commit/214a9a21cdc2eca572704836cb5b99568cdc1478))
- package updates ([ddbd9224](https://github.com/dereekb/dbx-components/commit/ddbd9224883f0d873fe910bcc31ca0b2edc851a4))
- package.json fixes ([b3331056](https://github.com/dereekb/dbx-components/commit/b333105687c6bc83c7163f8dcf1766f20cb53be8))
- package.json fixes ([1a352866](https://github.com/dereekb/dbx-components/commit/1a352866ec00824f285d9d9931002161ccb29ccf))
- parallel vitest workers for firebase tests ([e06e42a3](https://github.com/dereekb/dbx-components/commit/e06e42a39d3e4c99cabec98023f8bfa64b0f84e7))
- prepare for v13 release ([922648e5](https://github.com/dereekb/dbx-components/commit/922648e56e57abfd333db7f6ce4bfad06222b877))
- primativeValuesDelta() typing fix ([49f4dbc3](https://github.com/dereekb/dbx-components/commit/49f4dbc3a44415feffc79db4e990ac11ebda24b7))
- provide name refactor ([a7c05df0](https://github.com/dereekb/dbx-components/commit/a7c05df010bd74516dc5e7c8625fa65d9a311538))
- ran angular migration on demo application ([c8a59020](https://github.com/dereekb/dbx-components/commit/c8a59020d5c232d7f26427b62c35dcf075cbf8ce))
- rate limited clones the request before sending ([af935c9c](https://github.com/dereekb/dbx-components/commit/af935c9cc274e50bf0cc7cbc446042e275b6a671))
- recognize non-model fixtures in fixture validator ([2f130dad](https://github.com/dereekb/dbx-components/commit/2f130dadbd1e81d9d455dee807bdedc2efd5f548))
- recruit test fix ([0ed73e13](https://github.com/dereekb/dbx-components/commit/0ed73e1395ebb9ced5c419962aeb09e887d34022))
- redesigned DbxWebFilePreviewService ([e7a1e10b](https://github.com/dereekb/dbx-components/commit/e7a1e10be2d8b5b312e7748df27eaf5b7e9cfa54))
- ref input on ModelTestContextParams is now optionally a getter ([2597d15d](https://github.com/dereekb/dbx-components/commit/2597d15d56206af226259a95ad20e238254e52ea))
- refactored @dereekb/firebase snapshot field ([c88d2780](https://github.com/dereekb/dbx-components/commit/c88d2780d66f965a41ae299e013109f6860e9496))
- refactored AbstractFirestoreDocument type to use identity ([8f7a6f21](https://github.com/dereekb/dbx-components/commit/8f7a6f213b061b18c6b4f13bca34277e8bd3fc7e))
- refactored dbxActionSuccess ([5ea4ef20](https://github.com/dereekb/dbx-components/commit/5ea4ef208ce9efaf9c06f3c1d50b508498f1d782))
- refactored expandUniqueDateBlocksFunction() ([9f128b37](https://github.com/dereekb/dbx-components/commit/9f128b37ccbbbb11bd36f02aef0bf783e6348870))
- refactored filter directives ([f6eec08c](https://github.com/dereekb/dbx-components/commit/f6eec08cac69fd66133ecd0e8bcbda47f81e795d))
- refactored firebase-server file paths ([9ba18e62](https://github.com/dereekb/dbx-components/commit/9ba18e6225fb10d8de7b61bb6286669c63f31cdd))
- refactored firestore testing setup ([1caf6b45](https://github.com/dereekb/dbx-components/commit/1caf6b450931ba96d1a89fab9e285f6aa327f257))
- refactored FirestoreModelIdentity with collection ([20af3346](https://github.com/dereekb/dbx-components/commit/20af3346345c1a2aae7c20ca21b1fd90baeb63ce))
- refactored ModelTestContextDocumentRefParams and usage ([fdd0cf82](https://github.com/dereekb/dbx-components/commit/fdd0cf82dda17655a43679f6bb706e23d53a7648))
- refactored pdf merge editor extension ([16031394](https://github.com/dereekb/dbx-components/commit/1603139485243767633051dd2eec941e7d868d10))
- refactored timezoneAbbreviation() ([fa7d6626](https://github.com/dereekb/dbx-components/commit/fa7d6626157a83260267531864f3259ab24f128b))
- release fix ([d2bd7a02](https://github.com/dereekb/dbx-components/commit/d2bd7a020e0bc7a388970b38402fc5a611cf7702))
- release fix ([14093f0e](https://github.com/dereekb/dbx-components/commit/14093f0ed44c6bd339ab0c4f2d31e68ae362733b))
- release fixes ([dea054eb](https://github.com/dereekb/dbx-components/commit/dea054ebab58d2bb21ace3a8ad00cb393bc12be9))
- remove @angular/fire ([ccf2e030](https://github.com/dereekb/dbx-components/commit/ccf2e03094bcf365f7b087b92933c9e7dd5ce024))
- removed babel usage ([eb68fa0f](https://github.com/dereekb/dbx-components/commit/eb68fa0fd0fc936b7e5b789725730d5face3122d))
- removed constructor variable declarations ([002370d6](https://github.com/dereekb/dbx-components/commit/002370d6662f0be5ef0fa479508cac7949280bd8))
- removed converter from DocumentReference ([33e9f6aa](https://github.com/dereekb/dbx-components/commit/33e9f6aa33b83b93f2e08331855c26791557316a))
- removed default maxs from textField, textAreaField ([65f66701](https://github.com/dereekb/dbx-components/commit/65f667015d3cfd0c81e119eb06bd08993e7a0500))
- removed deprecated forge code ([971012bb](https://github.com/dereekb/dbx-components/commit/971012bbb4a6c18076c20f088c1cac8d22e65b72))
- removed deprecated functions ([b4330fab](https://github.com/dereekb/dbx-components/commit/b4330fabb339790e00432eb4e26fc6ae8bb61fb8))
- removed leftover debug logs ([c9792b05](https://github.com/dereekb/dbx-components/commit/c9792b058be93049a96db33513d12b1ae646da5d))
- removed unnecessary forRoot module declarations ([a8f850e7](https://github.com/dereekb/dbx-components/commit/a8f850e7e3a17c4aeaf83d5b92dba2464fa7a769))
- renamed .env.secret to .env.local ([43d29a88](https://github.com/dereekb/dbx-components/commit/43d29a887d4435da4023938ee3551a27aa061bc9))
- renamed conversionFunction to mapFunction ([6aeba772](https://github.com/dereekb/dbx-components/commit/6aeba7721dfd2721d5fe41216a1b81117be80aff))
- renamed DateBlockDayInfoFactory ([b0b57ff8](https://github.com/dereekb/dbx-components/commit/b0b57ff874496d6324a7bc18fb0e81e441ca5488))
- renamed dateBlocksInDateBlockRange ([2ddd4609](https://github.com/dereekb/dbx-components/commit/2ddd4609399907a3748b78e907e96e4361238ff0))
- renamed dateRangeState() to dateRangeRelativeState() ([4d93bc8a](https://github.com/dereekb/dbx-components/commit/4d93bc8a659ccbf27ef688925df18df4356558d3))
- renamed dbx-button style input to buttonStyle ([435a70ae](https://github.com/dereekb/dbx-components/commit/435a70aed334b46044286c40b1360ecf8e4a5c0c))
- renamed demo-firebase, demo-components ([a3360b39](https://github.com/dereekb/dbx-components/commit/a3360b39f2f895ca8ffe19eea30ff59d6f8798c0))
- renamed filterValuesUsingSet() ([7d3dc450](https://github.com/dereekb/dbx-components/commit/7d3dc450d338808d30a479c369b082ae029c99b5))
- renamed getterOrValue ([968fa445](https://github.com/dereekb/dbx-components/commit/968fa44519cbe867abba02a9ab2651adfc704367))
- renamed helpContextKey ([f2d3b30a](https://github.com/dereekb/dbx-components/commit/f2d3b30a0e8339102796a35f1c9191af1794e1bc))
- renamed id input to documentId ([a0e007c0](https://github.com/dereekb/dbx-components/commit/a0e007c0d4f355f4af4ba65bbfef80ed550f0386))
- renamed injected folder to injection ([6b4e30cd](https://github.com/dereekb/dbx-components/commit/6b4e30cdbcd6cb7e0910b14e93b8f22521709e97))
- renamed models folder ([bd98f66e](https://github.com/dereekb/dbx-components/commit/bd98f66ee610bd6dad7c7a2f65dd485d7510691c))
- renamed observableGetter to observableOrValue ([1a71e75c](https://github.com/dereekb/dbx-components/commit/1a71e75c26a0c5823146f93866bf7bc1b4346873))
- renamed UnknownYearWeekCode constant ([b4720607](https://github.com/dereekb/dbx-components/commit/b47206078dcf3f5a9c35ffc5e2a38dd37d1aca0e))
- renamed value to itemValue in dbxValueListItem ([34411292](https://github.com/dereekb/dbx-components/commit/34411292cf3400fe0aad8872b25d9eba7e4bd062))
- replaced .dbx-bold with M3 type-role utilities ([05437e02](https://github.com/dereekb/dbx-components/commit/05437e02a4da352ce0c243c56f188b26c5811b88))
- replaced FirestoreModelNames with FirestoreModelTypes ([8fcad6be](https://github.com/dereekb/dbx-components/commit/8fcad6be90c640f213446eb4e075be6768e0d720))
- replaced rxfire/firestore usage in stream() ([796bbbb3](https://github.com/dereekb/dbx-components/commit/796bbbb308a24d43bb8c6ef652324491c5071232))
- require key on dbxForgeGroup, add dbxForgeContainer ([9fbeec6c](https://github.com/dereekb/dbx-components/commit/9fbeec6c8ad227e229b2c8ce3eea3127c7c5a48d))
- required key on DbxValueListItem ([3e26491b](https://github.com/dereekb/dbx-components/commit/3e26491b4bc0414080be7f0daef32c076294bf59))
- resolve sonarqube issues ([c10ae11f](https://github.com/dereekb/dbx-components/commit/c10ae11fd71b6f5407762bc971e5d503ce562052))
- restored tsconfig.editor.json ([27171d52](https://github.com/dereekb/dbx-components/commit/27171d52626933409fad6cb463da14244e599873))
- revert type changes to testing functions ([84986342](https://github.com/dereekb/dbx-components/commit/8498634291479b23c0256241b2cf2f01d1798e68))
- revisited some todos ([4902b4bc](https://github.com/dereekb/dbx-components/commit/4902b4bcffde7174c37b72d84fd4473e3b975769))
- scrollbar fix ([09c92412](https://github.com/dereekb/dbx-components/commit/09c9241259baf03b1475b30cd56bdf89c42dcfd6))
- scss fixes ([fba59a1a](https://github.com/dereekb/dbx-components/commit/fba59a1adeb8aefdd0097f6e98fb2b0d39b5f9d5))
- section header style fix ([ce344d17](https://github.com/dereekb/dbx-components/commit/ce344d1746f81efef2264f61de9b5faae721a873))
- selection dialog mobile size fix ([e5edf264](https://github.com/dereekb/dbx-components/commit/e5edf264fce49351f06428fab1334fccead55f2b))
- send notification changes ([9a669e71](https://github.com/dereekb/dbx-components/commit/9a669e71ebfe1b23deb20fc5e476957b7c2de2ad))
- setup fixes ([8b5cbf8b](https://github.com/dereekb/dbx-components/commit/8b5cbf8b09fc92f53c645966cd19dd63cf0ea69f))
- setup project template fix ([aef7d751](https://github.com/dereekb/dbx-components/commit/aef7d751a50180aae8f19baaa3f1d3d04edc8ef4))
- setup-project fix ([5f5531f1](https://github.com/dereekb/dbx-components/commit/5f5531f19abb70dcca30d6d206954fe423a003c6))
- setup-project fixes ([6be8a959](https://github.com/dereekb/dbx-components/commit/6be8a9599e742ec23792a1837820fb3b55315e36))
- setup-project throttle fix ([eff25a9e](https://github.com/dereekb/dbx-components/commit/eff25a9e4a4813e071a31dddd255a92f57387560))
- setup-project.sh fixes ([2471606a](https://github.com/dereekb/dbx-components/commit/2471606a8a398542ba088f9645bce9ff05c76c6f))
- setup-project.sh template fixes ([c3debb29](https://github.com/dereekb/dbx-components/commit/c3debb299bcf2523e1b695fa19ca8aea18fc7a93))
- setup-project.sh template updates ([3bed8d9a](https://github.com/dereekb/dbx-components/commit/3bed8d9ae75e9ece4ed33d9bd397bc060eaa96c6))
- setup-project.sh template updates ([aff29f14](https://github.com/dereekb/dbx-components/commit/aff29f141fdd5f61d617553be4a959c2c1f52f77))
- ship firebase-api-manifest in @dereekb/dbx-cli ([61c0cdce](https://github.com/dereekb/dbx-components/commit/61c0cdce5674fbccc973f6a6763c6acd9f0dbd4a))
- shorter init out filenames in dbx-components-mcp ([5018bce0](https://github.com/dereekb/dbx-components/commit/5018bce036fd4fbf716c4cc82d76fabe96ec8811))
- sidenav fix ([b368b2eb](https://github.com/dereekb/dbx-components/commit/b368b2eb9356f770d31985f89c0095b35b4871ff))
- sidenav styling fixes ([b42c3412](https://github.com/dereekb/dbx-components/commit/b42c3412d37fb530cbf8df416da15764cd911a09))
- sonarqube fixes ([08bf595b](https://github.com/dereekb/dbx-components/commit/08bf595b4f938d3657f37d11776f7ff15eebdf0e)), closes [Array#push](https://github.com/dereekb/Array/issues/push)
- sonarqube refactoring ([537a68fb](https://github.com/dereekb/dbx-components/commit/537a68fb1173c8176fb06077ceafa4f9302ce5a1))
- standardized target to ES2022 on all packages ([148d6fbc](https://github.com/dereekb/dbx-components/commit/148d6fbc3272601375373db16d2acfab21f0164f))
- storage file initialization errors now delete created file ([53e55bf8](https://github.com/dereekb/dbx-components/commit/53e55bf8af3ce76242a9bedcc3d2a37c8f09cd50))
- style fixes ([d37306aa](https://github.com/dereekb/dbx-components/commit/d37306aab3e7dd55407dfcfdbf5535eae4a162c7))
- style fixes ([ec4dc6d3](https://github.com/dereekb/dbx-components/commit/ec4dc6d3e54ff19994b5bb493a06e938a57cc4b6))
- style fixes and mdc-to-mat token updates ([c7815e62](https://github.com/dereekb/dbx-components/commit/c7815e62b765fe507f1c21ac17a0b657024fc404))
- styling fixes ([a2a50d51](https://github.com/dereekb/dbx-components/commit/a2a50d514e4fe11460825222e8789a404e5b7d88))
- styling fixes ([245792fc](https://github.com/dereekb/dbx-components/commit/245792fc77559216ff5f54b2ba088aec6afb42a9))
- subtask code cleanup ([fd8886e7](https://github.com/dereekb/dbx-components/commit/fd8886e714101208c68ebde5488c69f7c60721e9))
- subtask continuation fix ([5c1c3a71](https://github.com/dereekb/dbx-components/commit/5c1c3a71f85edcd6148c6ef98469b0da4a7c2a7b))
- subtask typing changes ([6df7c8c6](https://github.com/dereekb/dbx-components/commit/6df7c8c622ddcefc2200c2179e950bff3fcd6415))
- synced setup-project.sh dep versions ([d99faf7b](https://github.com/dereekb/dbx-components/commit/d99faf7b27c3c4727dd3265823d07cfe8ac4cbba))
- template circleci config fix ([ae81adfb](https://github.com/dereekb/dbx-components/commit/ae81adfbfbb6603d420aa50a105b0d47276aa7b9))
- template refactoring ([3b561894](https://github.com/dereekb/dbx-components/commit/3b5618942f1567bee0156b80c8b4dc2f63114c72))
- test fix ([68eb1dd6](https://github.com/dereekb/dbx-components/commit/68eb1dd6b9b52eb0eceeb23bfc0869e366c9780a))
- test fix ([16062a6c](https://github.com/dereekb/dbx-components/commit/16062a6cb96174f13d192f8e606e2b7d87cf1577))
- test fix ([2a236f4f](https://github.com/dereekb/dbx-components/commit/2a236f4fe85732347e5e9a7f496962cbeda1fdd6))
- test fix ([ca92810c](https://github.com/dereekb/dbx-components/commit/ca92810c96ddd88e9c0412d7c44bc389c214197f))
- test fix ([7d7f8366](https://github.com/dereekb/dbx-components/commit/7d7f8366cec3dddf72bbaa2e318316a0c6ccfa1a))
- test fix ([0f09d4db](https://github.com/dereekb/dbx-components/commit/0f09d4db2dac09ad9c13558411b498f773f23f64))
- test fix ([30d0c7df](https://github.com/dereekb/dbx-components/commit/30d0c7dfbe0c14366ec82aa84608cfc045cd00d3))
- test fix ([c4897625](https://github.com/dereekb/dbx-components/commit/c48976258353488a1fd4349ae3df13f12807eac4))
- test fix, circleci fix ([d353d933](https://github.com/dereekb/dbx-components/commit/d353d93301a053430b175a667a8faa21c95102a7))
- test fixes ([4beda305](https://github.com/dereekb/dbx-components/commit/4beda3051aa88289a29361b284eef07248285d88))
- test fixes ([4d3fbfff](https://github.com/dereekb/dbx-components/commit/4d3fbfff511d92f7af1e9d9d418743c9f63bb786))
- test project fix ([9cb877ea](https://github.com/dereekb/dbx-components/commit/9cb877eafb9cb66018766d6490f6025038ec405b))
- text address test fixes ([7c62dc68](https://github.com/dereekb/dbx-components/commit/7c62dc68e2e8f8910cfeb1d3604cd34f9c09d70c))
- timezone display fix ([ba73cb6d](https://github.com/dereekb/dbx-components/commit/ba73cb6d9551132dcea448614d432df21c38d3fb))
- timezoneStringField() now defaults to no array ([13ebd262](https://github.com/dereekb/dbx-components/commit/13ebd26220059b248322be8a2eb67ad66916a9c6))
- today button is disabled when looking at today ([2a762f43](https://github.com/dereekb/dbx-components/commit/2a762f43a693f629c83619be3e7992f52b2aff6a))
- type change for beforeMonthViewRender() ([eb56c1e9](https://github.com/dereekb/dbx-components/commit/eb56c1e9ec94eaeea4b248fbf3136d15c23d56aa))
- type fix ([3d9e7247](https://github.com/dereekb/dbx-components/commit/3d9e7247ac8e40d96c82f7c1d557ac5652c9d0e1))
- type fix ([a6053a29](https://github.com/dereekb/dbx-components/commit/a6053a29eec068e3b8b23ffd17518bdf4fb3b7df))
- type fixes ([3545484d](https://github.com/dereekb/dbx-components/commit/3545484d6c88ea299dff4bd00e82e27f505c7ea2))
- type fixes ([b1f1a6dd](https://github.com/dereekb/dbx-components/commit/b1f1a6dd1a978de600a217c5a906d3340d001847))
- type fixes ([dbff3e48](https://github.com/dereekb/dbx-components/commit/dbff3e48538b2aa75604dde4652c331bc111c874))
- typing fix ([8fd3b806](https://github.com/dereekb/dbx-components/commit/8fd3b80666248c5ca6f5ec319cbee099370f4663))
- typing fix for ZohoRecruitSearchRecordsCriteriaEntry ([0cc267e1](https://github.com/dereekb/dbx-components/commit/0cc267e1f536db0803cec79b35730131e0df6e52))
- typo fix ([6914b00b](https://github.com/dereekb/dbx-components/commit/6914b00b372023b2c92a7f4ce24cfa1fc83ad27f))
- unified navbar-like overflow handling with dbx-flex-bar ([ccd2c790](https://github.com/dereekb/dbx-components/commit/ccd2c79086bba0a5e47a37e71e5132d7189cfd30))
- unique notification update ([95ea1ce5](https://github.com/dereekb/dbx-components/commit/95ea1ce5dad9799d45660a8324e6ffd068f9d646))
- update angular application package ([8b0fd223](https://github.com/dereekb/dbx-components/commit/8b0fd22379b46dbefd6a657d57e8540629543803))
- update CLAUDE.md ([dbd89f7d](https://github.com/dereekb/dbx-components/commit/dbd89f7d5d1ecb7b981c232b196186ac24591925))
- update dependencies ([bb805b4d](https://github.com/dereekb/dbx-components/commit/bb805b4d8615f542e513d954c572e97e1e25ef98))
- update force-start-release.sh ([705c9c3b](https://github.com/dereekb/dbx-components/commit/705c9c3b2e38171eebf3e4a3319229764172afee))
- update mailgun.js version ([723f5bde](https://github.com/dereekb/dbx-components/commit/723f5bde9c025b23cbe591d06f0a401548c45700))
- update ng-forge version ([bb00372b](https://github.com/dereekb/dbx-components/commit/bb00372be990df3ef8dce1ba464acd2798ef0685))
- update ng-forge version ([80516aba](https://github.com/dereekb/dbx-components/commit/80516abac47c971adc5904622984bec18ee7dca5))
- update nrwl/nx circleci ([db494033](https://github.com/dereekb/dbx-components/commit/db49403317d76de0d949212c24591bf287dc5c82))
- update zoho token handling ([d0e551bd](https://github.com/dereekb/dbx-components/commit/d0e551bda3c499a62337310f7bee0d67e58ac237))
- updated _pdf.scss ([5b852401](https://github.com/dereekb/dbx-components/commit/5b852401d0d0e48d7186518c20960f6cc07576f0))
- updated @nestjs dependencies to latest ([15ab7bc8](https://github.com/dereekb/dbx-components/commit/15ab7bc8ea5ad6deb34a2b2a5949a0095b70c55d))
- updated AbstractDbxPresetFilterMenuComponent ([447a689a](https://github.com/dereekb/dbx-components/commit/447a689a2dc9cc0ff236f98349578abcdbd24d6a))
- updated AbstractFirebaseServerNewUserService ([41648c41](https://github.com/dereekb/dbx-components/commit/41648c41a9ec0e1993a10ff137a12f3fb489b319))
- updated AbstractFirestoreDocument update() ([c052f143](https://github.com/dereekb/dbx-components/commit/c052f1437e88d319e37477bdd6ac81ceb77f2be2))
- updated AbstractRootSingleItemDbxFirebaseDocument ([914bbc64](https://github.com/dereekb/dbx-components/commit/914bbc646e34114941056edd872cf0ca7bcdaf05))
- updated accumulatorFlattenPageListLoadingState() ([6423b8f0](https://github.com/dereekb/dbx-components/commit/6423b8f0bd55d8b8d36c5dbc936ea1612ec212d3))
- updated addressField() ([b801042a](https://github.com/dereekb/dbx-components/commit/b801042a20dffaf68a43c1ea0eee6cc5e1959b25))
- updated allItems$ in ItemAccumulatorInstance ([4c87403f](https://github.com/dereekb/dbx-components/commit/4c87403f5a7b010a62f90f0d9dffac4a6501d071))
- updated anchor-list styling ([c7c3d8bb](https://github.com/dereekb/dbx-components/commit/c7c3d8bbfc412e92e7ee37d21dc17d8ec8ab75a1))
- updated app height mixins ([c696f715](https://github.com/dereekb/dbx-components/commit/c696f715481a91089816deec2a778dc4a5147abd))
- updated AssignValuesToPOJOFunction ([3267f82b](https://github.com/dereekb/dbx-components/commit/3267f82b17b8885ab8e1f97842396f655782498a))
- updated AuthorizedUserTestContextFactoryParams ([07873ba3](https://github.com/dereekb/dbx-components/commit/07873ba3c68096909eea0347a76b2eab0247fa3b))
- updated AuthRolesObsWithClaimsServiceConfig customization ([a3197415](https://github.com/dereekb/dbx-components/commit/a3197415571c84d5a686a82d321a7326dbff29e6))
- updated AuthUserInfo time types ([7e57bbb4](https://github.com/dereekb/dbx-components/commit/7e57bbb43635bf90cc0be87a8ee65523c45e5fe0))
- updated automatic isolate for vitest ([cc5c63fc](https://github.com/dereekb/dbx-components/commit/cc5c63fcc34fdbdea23305a21ca53f04c085672b))
- updated browserslistrc ([fc76d73b](https://github.com/dereekb/dbx-components/commit/fc76d73b5138d881738170159abde194ebb1938e))
- updated checkbox and toggle styling ([50d8e394](https://github.com/dereekb/dbx-components/commit/50d8e3949d45ebca0adede02e125b36bc3ef9639))
- updated cleanupDestroyable() to support Maybe ([a80f9859](https://github.com/dereekb/dbx-components/commit/a80f98593bed57a22e22e962c46329e09e808efc))
- updated client firestore initialization ([ca6d2956](https://github.com/dereekb/dbx-components/commit/ca6d2956422836d51724c9ee87d653d4a61bfd7e))
- updated combineLoadingState() to support more inputs ([a16b1378](https://github.com/dereekb/dbx-components/commit/a16b13783e9c113fcbfcb85e9369226466d97f4c))
- updated createNotificationTaskTemplate ([a6ea3b4f](https://github.com/dereekb/dbx-components/commit/a6ea3b4f20792e46256ece12db84f7dd41e310ce))
- updated date time field ([6accd2bc](https://github.com/dereekb/dbx-components/commit/6accd2bc4970a3eea1ee99f8ca3ed47e04a4731b))
- updated DateBlock utility function ([91aa34a7](https://github.com/dereekb/dbx-components/commit/91aa34a7468fcfdba825a440947489cd970ca377))
- updated DateBlockDayInfoFactory ([d1181ff7](https://github.com/dereekb/dbx-components/commit/d1181ff7293c792a63f2018afdc90122ca05a9ca))
- updated DateBlockDayInfoFactory to support DateBlockIndex ([85e6f405](https://github.com/dereekb/dbx-components/commit/85e6f40587f2faaa0fed1f661ffcffc63830ec6e))
- updated DateBlockRangeWithRange creation functions ([9056eaa2](https://github.com/dereekb/dbx-components/commit/9056eaa23e8cf2bb6dfcf887b0d3b93f8839722d))
- updated dateBlocksDayInfoFactory() ([ead90be9](https://github.com/dereekb/dbx-components/commit/ead90be96b805b70ef2b967803879778eee8c7a5))
- updated dateBlocksExpansionFactory to allow DateBlockRange ([a5137004](https://github.com/dereekb/dbx-components/commit/a5137004de8d282978b2cef574ee69995c7c5f2a))
- updated dateBlocksExpansionFactory() to support filter ([1a7f7286](https://github.com/dereekb/dbx-components/commit/1a7f728621e4c13a380610e0b0064c7025bc3ab0))
- updated dateBlockTimingFromDateRangeAndEvent() ([0e1919a5](https://github.com/dereekb/dbx-components/commit/0e1919a58f4e2f600c1513c890374a64cbfabe91))
- updated dateFromLogicalDate() ([bdbd2f7b](https://github.com/dereekb/dbx-components/commit/bdbd2f7bce7c0f8d205b73fb56bdbe24d54e3860))
- updated dateTimeField() ([709b6e80](https://github.com/dereekb/dbx-components/commit/709b6e8065beb287ebc8d2a36104307505860659))
- updated dateTimeField() ([df14cc32](https://github.com/dereekb/dbx-components/commit/df14cc32ae4847e1b5c0050e19c1c246e80a0f89))
- updated dbx-bar-header colors ([1a147e1e](https://github.com/dereekb/dbx-components/commit/1a147e1e69a1ef843823426d696b982b24a797c4))
- updated dbx-button colors ([dfe075a2](https://github.com/dereekb/dbx-components/commit/dfe075a290a798df22da712b7cb68480420550ba))
- updated dbx-cli deploying ([21d5dc2d](https://github.com/dereekb/dbx-components/commit/21d5dc2d922ba02a6bf55c6b0f3f2d2878894cc6))
- updated dbx-components-mcp ([6bcfa2d4](https://github.com/dereekb/dbx-components/commit/6bcfa2d4616ae024b1ba4dec26dd91a93e6bcb0d))
- updated dbx-error ([1038c12f](https://github.com/dereekb/dbx-components/commit/1038c12f0c7c93c92fe36770f663237e76aeba3a))
- updated dbx-grid, dbx-accordion ([84e8bb48](https://github.com/dereekb/dbx-components/commit/84e8bb48b3dacaa74d696049d27bf339ad3fd641))
- updated dbx-linkify ([000c1ec4](https://github.com/dereekb/dbx-components/commit/000c1ec4413ef55fc7f624ba8b666381400f44d2))
- updated dbx-navbar ([d9f830b4](https://github.com/dereekb/dbx-components/commit/d9f830b41e3dabf744804499cc2a5b6d18871a66))
- updated dbx-section wrapper config ([0be74682](https://github.com/dereekb/dbx-components/commit/0be7468231995b66aecfa9aa670f264336b7c455))
- updated dbx-section-header content ([f7c3a722](https://github.com/dereekb/dbx-components/commit/f7c3a72281bf4875195dfcb32cd961f92f6b2cc6))
- updated DbxActionAnalyticsConfig onSuccess ([999bfe3c](https://github.com/dereekb/dbx-components/commit/999bfe3c80b77a776bef4bd00798705fd4cc0341))
- updated DbxActionConfirmDirective ([fe2c280c](https://github.com/dereekb/dbx-components/commit/fe2c280c7c43888b2d763bcd011a748f37da3b5e))
- updated DbxCalendarScheduleSelectionStore indexes input ([e423e94a](https://github.com/dereekb/dbx-components/commit/e423e94af18cfd2661669ace1270dab3c914c568))
- updated DbxCalendarScheduleSelectionStore indexes output ([04afe36b](https://github.com/dereekb/dbx-components/commit/04afe36b82384cc7bb43f08080fd6272c8bf1976))
- updated DbxCalendarScheduleSelectionStore output ([bd66b24b](https://github.com/dereekb/dbx-components/commit/bd66b24bad36a6e286aa0b07f90ca4824b98d357))
- updated DbxDateTimeFieldComponent ([a37b7f3a](https://github.com/dereekb/dbx-components/commit/a37b7f3a4c0476781450c0b24c33bf4a947d2eac))
- updated DbxDateTimeFieldComponent ([68c24cb7](https://github.com/dereekb/dbx-components/commit/68c24cb7ec56213bc3aa81ed76958b5a7dfa5730))
- updated DbxDateTimeFieldComponent time picker ([4a68bb6d](https://github.com/dereekb/dbx-components/commit/4a68bb6d27c5cfb3a7440e12b2b9b44a1d8ffe11))
- updated DbxFirebaseAuthService authUserState$ ([320cf5e3](https://github.com/dereekb/dbx-components/commit/320cf5e38df723ab7e8f49d47479559375faa0e0))
- updated DbxFirebaseAuthService observables ([b593142c](https://github.com/dereekb/dbx-components/commit/b593142c0b1464b54db0f1a9dda7353d7c58d3f1))
- updated DbxFirebaseLoginEmailContentComponent recovery ([972c4781](https://github.com/dereekb/dbx-components/commit/972c47817254017d73b5a370a4b7fc36c1cf21d5))
- updated DbxFirebaseModelEntitiesComponent ([c4d7ecfc](https://github.com/dereekb/dbx-components/commit/c4d7ecfcdacce3314dc082de814d336817302db3))
- updated DbxFirebaseModelEntitiesEntityComponent ([230675b4](https://github.com/dereekb/dbx-components/commit/230675b48a77b922fe6839ff92e250e6aa804314))
- updated DbxFirebaseModelEntitiesEntityComponent ([6bdc0a02](https://github.com/dereekb/dbx-components/commit/6bdc0a0284d9199fbc3ccb2547ba3074eb27a901))
- updated DbxfirebaseModelViewedEventDirective to use ngZone ([9e9f86c9](https://github.com/dereekb/dbx-components/commit/9e9f86c908d2006fb9db91347eb2445a512e8b96))
- updated DbxFirebaseStorageFileDownloadButtonComponent ([f828dc72](https://github.com/dereekb/dbx-components/commit/f828dc72127c1533be94cb416d1c07671eddbcfd))
- updated DbxFixedDateRangeFieldComponent ([966cb6d1](https://github.com/dereekb/dbx-components/commit/966cb6d105bb0371cd3f92d9e823d8b9922f2c8c))
- updated DbxFormFormlyDateFieldModule ([6f1fc258](https://github.com/dereekb/dbx-components/commit/6f1fc258434d5883eb5dc8d4fc26b7aa5729eb00))
- updated DbxFormMapboxLatLngFieldComponent ([d6da6302](https://github.com/dereekb/dbx-components/commit/d6da630274c22f710a7d9af5cea9512242a31288))
- updated DbxFormMapboxLatLngFieldComponent ([673ded3c](https://github.com/dereekb/dbx-components/commit/673ded3cb3201d426f7b4e0365b54fdb88ef4390))
- updated DbxFormMapboxLatLngFieldComponent ([8892c045](https://github.com/dereekb/dbx-components/commit/8892c045288dea85079447ac3e12da37f2068825))
- updated DbxFormMapboxLatLngFieldComponent rounding ([aff0c815](https://github.com/dereekb/dbx-components/commit/aff0c815ec134650e22ad97aaff6ee6899f86bf7))
- updated DbxFormRepeatArrayTypeComponent config type ([ec95adb1](https://github.com/dereekb/dbx-components/commit/ec95adb12462afdac731baac39aafec0c10f1160))
- updated DbxMapboxLayoutComponent to use 'side' mode ([c4d8cbc1](https://github.com/dereekb/dbx-components/commit/c4d8cbc16ccd097401e59cda7ca335d972e8ad32))
- updated DbxMapboxMapStore bound$ value ([ebaa027a](https://github.com/dereekb/dbx-components/commit/ebaa027a1fff17729b761de541184f110330c955))
- updated DbxMapboxMarker to allow latLng to be a string ([70289b07](https://github.com/dereekb/dbx-components/commit/70289b0788eafa142c7e767d8bd537108a4757ff))
- updated DbxMapboxMarkersComponent change detection ([e64a501b](https://github.com/dereekb/dbx-components/commit/e64a501bfa84bf8461d79cf42ea029939a2027df))
- updated DbxModelTypeConfigurationSrefFactory type ([7d9fb77f](https://github.com/dereekb/dbx-components/commit/7d9fb77f91c4c2027f871cb0eea6dcc623070d9a))
- updated DbxNavbarComponent button mode ([c2a3781b](https://github.com/dereekb/dbx-components/commit/c2a3781b111e8ea518cfde17e808bd77878734ae))
- updated DbxNavbarComponent to hide the caret by default ([aaa28f7e](https://github.com/dereekb/dbx-components/commit/aaa28f7ee30200bd42b4bd010a1ddfe53e8acdc1))
- updated DbxRouterService ([c3614dca](https://github.com/dereekb/dbx-components/commit/c3614dcab2623778b595ea2334f07f7eee413398))
- updated DbxScheduleSelectionCalendarDateRangeComponent ([87549197](https://github.com/dereekb/dbx-components/commit/87549197545cc4f43b6619cc754a4d02aac304d9))
- updated DbxScheduleSelectionCalendarDateRangeComponent ([11ce3622](https://github.com/dereekb/dbx-components/commit/11ce36227c72ad4128939e3a034e09eb568aab1f))
- updated DbxTableReader ([8a519fd9](https://github.com/dereekb/dbx-components/commit/8a519fd9f5c8c10c694f285327378bb7e28df22e))
- updated DbxThemeColor support ([2c16ea22](https://github.com/dereekb/dbx-components/commit/2c16ea22be5b503046471347763750682c4d00ef))
- updated demo to reflect build changes ([355421cf](https://github.com/dereekb/dbx-components/commit/355421cf263ad166aa4602cbd29225e5a92b139f))
- updated E164PhoneNumber type ([15a39490](https://github.com/dereekb/dbx-components/commit/15a3949054e935ee2f9cf12bda0d883bd89fccbb))
- updated enableHasAuthRoleHook() ([b811e534](https://github.com/dereekb/dbx-components/commit/b811e5342ea0311269050c46e3e5bbfdf958393a))
- updated error popover content ([54a67634](https://github.com/dereekb/dbx-components/commit/54a67634360d0aee3b7be82c147613786f198d8d))
- updated expandDateBlockRange() to accept DateBlockRange ([bb02eab5](https://github.com/dereekb/dbx-components/commit/bb02eab515d8c9a877ecdfcf5469ccb18796541a))
- updated expandMailgunRecipientBatchSendTargetRequestFactory() ([462a64d6](https://github.com/dereekb/dbx-components/commit/462a64d6f9cf6299cde2ffde675b7b0430e4bcbb))
- updated expandNotificationRecipients() ([fcaf8352](https://github.com/dereekb/dbx-components/commit/fcaf8352d310ac6d15d8fd5eb3a03dffc00c0d65))
- updated FetchURLQueryParamsInput type ([f357dca2](https://github.com/dereekb/dbx-components/commit/f357dca2c01056f85fb23de5e8220a5b1dd22f3d))
- updated FetchURLSearchParamsObject ([951875be](https://github.com/dereekb/dbx-components/commit/951875be2f73f9877bf6a895942e6cc03aa5e3e3))
- updated firebase-server/zoho build ([2e59540e](https://github.com/dereekb/dbx-components/commit/2e59540eb434a68fee882ee199d3dbf30cb19411))
- updated firebase-tools related types ([63793d5e](https://github.com/dereekb/dbx-components/commit/63793d5eaa2a04a1b64870dfd886488f7d477cb1))
- updated firebaseDocumentStoreFunctions input type ([6ca91e67](https://github.com/dereekb/dbx-components/commit/6ca91e67e666caa2a568f3066370db5f2f9980d8))
- updated FirebaseFunctionCreateAction to allow input ([dfb52505](https://github.com/dereekb/dbx-components/commit/dfb52505106b6cf5da9f5daf556e4e038e22b00a))
- updated FirebaseFunctionUpdateAction input ([0aecf021](https://github.com/dereekb/dbx-components/commit/0aecf0219617a6c45d219417022e9358337d1613))
- updated firebaseServerActionsTransformFactory() with logging ([d03cafc2](https://github.com/dereekb/dbx-components/commit/d03cafc27d98f4ff4921dc0dc2424b2a6803d509))
- updated FirebaseServerAuthNewUserSendSetupDetailsConfig ([adbbd9f0](https://github.com/dereekb/dbx-components/commit/adbbd9f020bc9331381ae8db36b857dc6715a102))
- updated firestore document utilities, added tests ([c8c19d77](https://github.com/dereekb/dbx-components/commit/c8c19d7755c77ad9d6963fa09927fc331321b2f1))
- updated firestore utilities and test config ([d5d0e382](https://github.com/dereekb/dbx-components/commit/d5d0e38223292bca36761517c66b71f544772323))
- updated FirestoreCollectionExecutableDocumentQuery ([e1428281](https://github.com/dereekb/dbx-components/commit/e14282813dae744bd92bef6247d834b78af6a76a))
- updated FirestoreEncodeArray to be FirestoreFieldMapArray ([31a42469](https://github.com/dereekb/dbx-components/commit/31a42469629eb3ef2106d8a54a8a04dbe50568e0))
- updated firestoreSubObject() result ([473942f7](https://github.com/dereekb/dbx-components/commit/473942f7665272fd2c9d2af309d41b03f52422a2))
- updated full summary row presentation ([a5ae8c40](https://github.com/dereekb/dbx-components/commit/a5ae8c40e5c1b9817f9c92aef22a90bd57e77dff))
- updated generator instructions ([71c43631](https://github.com/dereekb/dbx-components/commit/71c436310d41fb6ce868c090bbe982cb95c6985b))
- updated handler and zoom webhook handler ([74f442c5](https://github.com/dereekb/dbx-components/commit/74f442c5de678a8d048ad43d5f2f92c50dcc38e5))
- updated header type of DbxTwoColumnRightComponent ([75ad8b45](https://github.com/dereekb/dbx-components/commit/75ad8b4562283e90b8a218cf564785d5843a32dd))
- updated help, entities widgets lists ([bade9c1b](https://github.com/dereekb/dbx-components/commit/bade9c1b8da64d0c91e5eee35b4aa81343890520))
- updated IconAndTitle icon type ([8bb7132a](https://github.com/dereekb/dbx-components/commit/8bb7132a604b5c64cb510605e3cddd659b470d62))
- updated isDefaultLatLngPoint() ([172aef5a](https://github.com/dereekb/dbx-components/commit/172aef5adc30d32d6cc984c7b0251ffaa92be476))
- updated isSameLatLngPoint() to allow Maybe values ([4e5d4193](https://github.com/dereekb/dbx-components/commit/4e5d4193de7b355ade9b3c296b63caa5cdcedb10))
- updated isValidDateBlockTiming() ([21963872](https://github.com/dereekb/dbx-components/commit/21963872e4ace496090a7064940954f4b5aa0788))
- updated iterateFirestoreDocumentSnapshotBatches() ([f6920764](https://github.com/dereekb/dbx-components/commit/f6920764463b0202fa7f4685f3c93e596d05e5c6))
- updated IterateFirestoreDocumentSnapshotCheckpointsConfig ([9665c784](https://github.com/dereekb/dbx-components/commit/9665c784e31d8dd5e38387458144d2f5a3d31008))
- updated jsdocs for query and pagination utilities ([21ff80b1](https://github.com/dereekb/dbx-components/commit/21ff80b1560ac6dff57c6774e4e9571f7e6ad4ce))
- updated jsdocs for util, rxjs, model, and date ([#34](https://github.com/dereekb/dbx-components/issues/34)) ([fe49828c](https://github.com/dereekb/dbx-components/commit/fe49828ca694f385f903843f599bfd3e0df47af7)), closes [#34](https://github.com/dereekb/dbx-components/issues/34)
- updated jsdocs for zoho crm and recruit ([4da61f42](https://github.com/dereekb/dbx-components/commit/4da61f427658f96d9fdccc911ff1c696c4795956))
- updated keydown listener ([ff40a181](https://github.com/dereekb/dbx-components/commit/ff40a1818c7ded86de98d245996488b3a3fd9ed1))
- updated latestSnapshotsFromDocuments() ([8ef7843d](https://github.com/dereekb/dbx-components/commit/8ef7843df1bc25b7eca184e457410299fe2dba6e))
- updated license copyright ([87956fdf](https://github.com/dereekb/dbx-components/commit/87956fdf391d1a0f9da8d0e221eb8d3b066d643f))
- updated LoadingState types ([60ae02b9](https://github.com/dereekb/dbx-components/commit/60ae02b9f8494d727a8c0994cd3ce76da5e68fef))
- updated mailgun notification handling ([21a1b4ed](https://github.com/dereekb/dbx-components/commit/21a1b4ed88952fc506aaa30c0e51e24103baa4e6))
- updated MailgunRecipientBatchSendTarget ([9d2d4747](https://github.com/dereekb/dbx-components/commit/9d2d4747c2a87324e1be4d8f52c2444aac1ff582))
- updated mailgunServiceConfigFactory() config ([55a0c07e](https://github.com/dereekb/dbx-components/commit/55a0c07e15419959329e57056a105fc402f00ba1))
- updated mapbox drawer width and button coloring ([53211ac8](https://github.com/dereekb/dbx-components/commit/53211ac8e6c842073ad071357f2da9a1b06c0188))
- updated mapHttpsCallable() to throw FirebaseServerError ([bf52e182](https://github.com/dereekb/dbx-components/commit/bf52e18204765a25d7ad4a86096e954901e1eb5c))
- updated mapLoadingStateValueWithOperator() ([9cf3cb65](https://github.com/dereekb/dbx-components/commit/9cf3cb65865adb889c484747b21d25e78048807a))
- updated markerConfig in DbxFormMapboxLatLngComponentFieldProps ([79d55016](https://github.com/dereekb/dbx-components/commit/79d55016a92be88a09ddcf9c471085cbcf801f76))
- updated model cli manifest documentation ([518b6fdb](https://github.com/dereekb/dbx-components/commit/518b6fdbbd75310f2ed5575f2c4d7f6ca6314cc6))
- updated multiValueMapBuilder() ([b02825ae](https://github.com/dereekb/dbx-components/commit/b02825ae8027562b4e872d5e64fc4795c4f6a338))
- updated NewUserMailgunContentRequest with contact info ([b91bd7ff](https://github.com/dereekb/dbx-components/commit/b91bd7ffc365c6360b69fbf080751064174ad751))
- updated ng-forge version to 0.8.0 ([369f23b1](https://github.com/dereekb/dbx-components/commit/369f23b1145a6438ca6624ced8719ab12825cd80))
- updated ngx-mapbox-gl ([ff51d993](https://github.com/dereekb/dbx-components/commit/ff51d99336c74f0b5441b8bd62c7bbab5c7caf31))
- updated notification logged event tests ([eaa088cd](https://github.com/dereekb/dbx-components/commit/eaa088cd4f40e5c00a026fb99422627e9b326f58))
- updated notification server actions ([142df16c](https://github.com/dereekb/dbx-components/commit/142df16c5bb4ce723fb58cbd722f64f2b09c091c))
- updated NotificationMessage skip flag ([93e0ba29](https://github.com/dereekb/dbx-components/commit/93e0ba29de00d51d9d449a6b84bf3fa36bbef111))
- updated NotificationMessageContent ([efd7679b](https://github.com/dereekb/dbx-components/commit/efd7679b8b10604d46e214c72a20d54ee3797537))
- updated NotificationTaskServiceHandleNotificationTaskResult ([78c8a37b](https://github.com/dereekb/dbx-components/commit/78c8a37bffe8e76511ddc54320c7de1b3aee71b7))
- updated numberFieldTransformParser() maybe value handling ([19766090](https://github.com/dereekb/dbx-components/commit/197660901a669a16bfbadcf3393ece3d5eb265f1))
- updated nx to v14.8.6 ([4635fb11](https://github.com/dereekb/dbx-components/commit/4635fb1127b20fdd41a7754643e6f4990df95bfd))
- updated onCallCreateModel() for optional auth ([b6bce5f8](https://github.com/dereekb/dbx-components/commit/b6bce5f8ba1d8203e5c59ca885bc67ca7eed5c87))
- updated OnCallWithNestContextRequest to use single object ([2ef40021](https://github.com/dereekb/dbx-components/commit/2ef4002153d3e4b7efb012e31b2739378ac49789))
- updated optionalFirestoreArray() ([aff5fbe8](https://github.com/dereekb/dbx-components/commit/aff5fbe80bd98613d7bac2ebe7959d5ca4f95bd3))
- updated optionalFirestoreDate() ([2d501fd8](https://github.com/dereekb/dbx-components/commit/2d501fd8b6f653eb73f39fe2fb4118d433bf0f5b))
- updated optionalFirestoreString to have a generic type ([1ce52b54](https://github.com/dereekb/dbx-components/commit/1ce52b54898db22705fbdbc408ee1f127b877928))
- updated PerformAsyncTasksConfig ([56e2d216](https://github.com/dereekb/dbx-components/commit/56e2d216208de84021f276f34f7284e7fb2a6290))
- updated preconditionConflictError() ([c8a661fc](https://github.com/dereekb/dbx-components/commit/c8a661fc27e93ffea9b0d25228199a6bf9fcd7f3))
- updated project templates ([7f0b1ddc](https://github.com/dereekb/dbx-components/commit/7f0b1ddc792fd3869aad3cffd72366e2ae614dca))
- updated project templates and setup instructions ([340895ea](https://github.com/dereekb/dbx-components/commit/340895ead37301b6fff7cb47a4266833aa8aa4c9))
- updated projectId generation for tests ([db31e24b](https://github.com/dereekb/dbx-components/commit/db31e24b6ed730176c18f482c29daf69b8f3aa33))
- updated readme ([88fbbac5](https://github.com/dereekb/dbx-components/commit/88fbbac582baa8b0e1ee738b6047b5b6c898c642))
- updated related dbxListViewDirective name ([afcc8248](https://github.com/dereekb/dbx-components/commit/afcc82480d57970048b77421fffef7140a9d1050))
- updated repeatArrayField() ([816d58fe](https://github.com/dereekb/dbx-components/commit/816d58fec266604c4209b0ba42d13b1d40a56cbc))
- updated RepeatArrayFieldConfig to allowed ArrayOrValue ([684a36b1](https://github.com/dereekb/dbx-components/commit/684a36b180d7467a51a9f80f6e93332f1a13a1dd))
- updated rrule ([d6a9f587](https://github.com/dereekb/dbx-components/commit/d6a9f5872cea6ac17043f8ff936f4260a31d6dca))
- updated searchable fields ([547ea013](https://github.com/dereekb/dbx-components/commit/547ea01387e81ecb3d01f8e7b78f0c70b104a4f5))
- updated searchStringFilterFunction() ([61a82f47](https://github.com/dereekb/dbx-components/commit/61a82f479a0def388ddf2664f0081e21747f4781))
- updated sendQueuedNotificationsFactory ([a75b606b](https://github.com/dereekb/dbx-components/commit/a75b606b158956b9835ee8aba4ccd322f5614cf5))
- updated ServerErrorResponseData type ([82c0b2f1](https://github.com/dereekb/dbx-components/commit/82c0b2f1b4bcd25b0ca433bff2b25b0cafaeb4c8))
- updated setRoles() with claimsToRetain input ([35ef2b09](https://github.com/dereekb/dbx-components/commit/35ef2b09423223956b37cc04f9fb58d18bdad315))
- updated setup-project build config ([2f13d7e3](https://github.com/dereekb/dbx-components/commit/2f13d7e3948a0e5df034dbe8b2ed2197180a3d89))
- updated setup-project.sh ([0c158987](https://github.com/dereekb/dbx-components/commit/0c158987df5b308377c5263df9d50ba105224ffc))
- updated setup-project.sh ([e970f557](https://github.com/dereekb/dbx-components/commit/e970f55776168db8c227b3e2947f9b8496cbc964))
- updated setup-test eslint config ([c12d8c07](https://github.com/dereekb/dbx-components/commit/c12d8c073f5ed67ab0757d15e9f6d71bf339ad5d))
- updated SingleItemFirestoreCollection ([13c16157](https://github.com/dereekb/dbx-components/commit/13c161579e5097fddff3e9fa6ad9abd105105bdd))
- updated SingleItemFirestoreCollectionConfig to not require id ([4fb9a61e](https://github.com/dereekb/dbx-components/commit/4fb9a61e764009ce68d16d597147b1c4d6ae9347))
- updated SourceSelectionOpenSourceResult ([9872cdad](https://github.com/dereekb/dbx-components/commit/9872cdadc1e3df4e6599253cc1a23dff0e98c38b))
- updated storageFileInitializeFromUploadService() ([dfe5a831](https://github.com/dereekb/dbx-components/commit/dfe5a8313544e5e8148adcb88dd6d22292f83cc1))
- updated store jsdocs, commitlint types ([5ac28a9d](https://github.com/dereekb/dbx-components/commit/5ac28a9d135fcdc3dcd0d3e25208a86a1f592867))
- updated StringConcatination ([3d246e30](https://github.com/dereekb/dbx-components/commit/3d246e30280596e4bee4adc2d1d2ed00f7791485))
- updated task error handling ([ee481286](https://github.com/dereekb/dbx-components/commit/ee48128615c63da139770526fd299d429ff2636f))
- updated test uid generation ([41aed3cd](https://github.com/dereekb/dbx-components/commit/41aed3cd4e3780e31c19ca7299fcb21bb58ea2e8))
- updated tests with onCallModel usage ([785b953c](https://github.com/dereekb/dbx-components/commit/785b953c90e4a47b0ba7d32bb8d32a592341a6fc))
- updated timezone abbreviation on range selection component ([10582f77](https://github.com/dereekb/dbx-components/commit/10582f7797fac2998b31fdb671c8a685da9556ee))
- updated TreeNode utilities ([85cec05f](https://github.com/dereekb/dbx-components/commit/85cec05f7677d3aa4e5a9c4e076e23c409d65304))
- updated typing of latestSnapshotsFromDocuments ([aac462c8](https://github.com/dereekb/dbx-components/commit/aac462c84915456a6def719653be450e3b2fff90))
- updated UnitedStatesAddress to use Maybe ([7256616a](https://github.com/dereekb/dbx-components/commit/7256616afda2580316b08b4135bad11a8f9fe667))
- updated usage of clean() ([edfc9434](https://github.com/dereekb/dbx-components/commit/edfc943454742a5bb7bbce4dd44d52a8ddaf23be))
- updated UseFirebaseModelsServiceSelection key input ([0dc0d6b9](https://github.com/dereekb/dbx-components/commit/0dc0d6b9e7163b7ad75c322a8e375026038c2fe2))
- updated valueFromLoadingState() ([10f9d7c4](https://github.com/dereekb/dbx-components/commit/10f9d7c475eee9ed791e42073922663906c17828))
- updated vapi types and dependency ([9e7766f1](https://github.com/dereekb/dbx-components/commit/9e7766f1902f1f911dcfa37374a49068a38b7410))
- updated vitest config ([39ff2d2c](https://github.com/dereekb/dbx-components/commit/39ff2d2c400af6ce0c6f1e71d9be39f67411b908))
- updated withApiDetails to single config object ([f85ed106](https://github.com/dereekb/dbx-components/commit/f85ed106c08c4010c8291a025818b4a6c056f528))
- updated yearWeekCodeGroupFactory() input ([4460cd36](https://github.com/dereekb/dbx-components/commit/4460cd365e4a1d72fa1fdd41ccf8f4d3612fdee8))
- updated zoho crm attachment upload to use File ([d098e6e2](https://github.com/dereekb/dbx-components/commit/d098e6e22f671a77e5755af25f9dc4980187e315))
- updated Zoho Recruit types ([ca8c64d1](https://github.com/dereekb/dbx-components/commit/ca8c64d17e59c83d48a56bacce3a423b3480e5ed))
- updated Zoho Recruit types ([47e19042](https://github.com/dereekb/dbx-components/commit/47e19042b0d0baa6c2508c30d425014d4f1c552c))
- updated Zoho Recruit types ([c4aee140](https://github.com/dereekb/dbx-components/commit/c4aee1409f1019fa65676d23cef3168649e9cd46))
- updated zoho sign/recruit api and fetch utils ([fb7f4dc7](https://github.com/dereekb/dbx-components/commit/fb7f4dc7f7bd6d08e03ec6e9f921b1fc7ff4171f))
- updated zoho-cli output config ([1fbcad1c](https://github.com/dereekb/dbx-components/commit/1fbcad1c90d57216702ed662e85f84b0d3c4ba56))
- upgraded stripe sdk from v9 to v20 ([11d0cb6e](https://github.com/dereekb/dbx-components/commit/11d0cb6e132161cfc3c5be018a5e57276138b572))
- use formly-prefixed names in dbx-form internals ([aa78aa79](https://github.com/dereekb/dbx-components/commit/aa78aa79354f2825403fae526290de06ecc8a5f8))
- use specific field def types in forge registry ([783b8eac](https://github.com/dereekb/dbx-components/commit/783b8eac5ed31b065586e2b611a35bc1e08eae04))
- **util:** add stripObject for filtering empty pojos ([f9255d3b](https://github.com/dereekb/dbx-components/commit/f9255d3b3c05159284c200b44d0569eca95becf5))
- validator decorator message fix ([ee213057](https://github.com/dereekb/dbx-components/commit/ee213057041cccdaf6a23b8a854bdf5df617e1f8))
- vapi webhook type fixes ([3af9dc37](https://github.com/dereekb/dbx-components/commit/3af9dc371ad1e46cb4f30be2175f212cf75ef6c3))
- variable renamed ([b8d153f8](https://github.com/dereekb/dbx-components/commit/b8d153f8643fcc741cc3e7930b445d4852bed1fb))
- various changes ([52e0930b](https://github.com/dereekb/dbx-components/commit/52e0930bec93d5d5acd983562ac32a3903772017))
- various fixes and changes ([b00b7db6](https://github.com/dereekb/dbx-components/commit/b00b7db6bfed3130dbdab8278ab9f8a15e33edfc))
- various ui improvements ([c05407a9](https://github.com/dereekb/dbx-components/commit/c05407a96f482acfdf8821ec6e296cb23042da5d))
- version bumping fix ([01b0f89d](https://github.com/dereekb/dbx-components/commit/01b0f89d9df6a3aeb1b1906b1c42469b548e2a82))
- vitest import fixes ([5f7123b3](https://github.com/dereekb/dbx-components/commit/5f7123b3f88aba868db0398244acd68aea541700))
- zoho setup script + dbx.setup.json manifest ([5cfa6862](https://github.com/dereekb/dbx-components/commit/5cfa6862d5848519f0c2d421c56965fefa43be2d))
- zoho sign template id ([0d0bd2e8](https://github.com/dereekb/dbx-components/commit/0d0bd2e8cacf7e2617e2a327e3f31fa767e0ff3b))
- zoho-cli multi-page pagination flags ([e95817dd](https://github.com/dereekb/dbx-components/commit/e95817ddb0117098feb76dcce051e0de10fd2018))
- zoom api test changes ([81d1e5f3](https://github.com/dereekb/dbx-components/commit/81d1e5f340d1f41d8501c7fbd0020768e3cacca9))
- zoom webhook controller ([90e579d0](https://github.com/dereekb/dbx-components/commit/90e579d0fb319f7d366e7e37abacf45bf90e569c))
- zoom webhook controller fix ([82110f79](https://github.com/dereekb/dbx-components/commit/82110f79962dcb4c7be6c5d23ba7ae37604446a7))


### Continuous Integration

- @dereekb/model will now be published properly ([7e70d963](https://github.com/dereekb/dbx-components/commit/7e70d96347d0325a478dc321fd5bc1d84b18c220))
- added ci firebase rule deploy step ([3da791d7](https://github.com/dereekb/dbx-components/commit/3da791d70b66487655b42a5a191c61df7706b46a))
- added explicit Angular version to setup ([6b2bb5cc](https://github.com/dereekb/dbx-components/commit/6b2bb5cc1734334030952e442b506580b0d04563))
- added run_tests, run_setup_test pipeline parameter ([ac59c756](https://github.com/dereekb/dbx-components/commit/ac59c7561bd3fdaa32603da40ccf5aba507313f2))
- added snyk ([ff58e920](https://github.com/dereekb/dbx-components/commit/ff58e9203ec2301588fb2ca3f0a2c6656b45eebc))
- deploy build fixes ([dbe6592e](https://github.com/dereekb/dbx-components/commit/dbe6592ede4166ef02d02bb0fe1d186ee24a4c74))
- deploy fix ([f89d3adb](https://github.com/dereekb/dbx-components/commit/f89d3adb416f6508cdc3c787f106de6c4970dc64))
- disabled cypress install ([a6f07b1a](https://github.com/dereekb/dbx-components/commit/a6f07b1a0d50bb70f10e459ba8f7c0129e768f17))
- enabled demo-api tests in circleci ([70237762](https://github.com/dereekb/dbx-components/commit/702377627c40c077ee77783b2c1613e302861272))
- fixed setup script dependencies for mapbox ([abbf038b](https://github.com/dereekb/dbx-components/commit/abbf038bb26bc5a40d922032b5501aaa97747a88))
- improve circleci caching and cleanup ([9de7abba](https://github.com/dereekb/dbx-components/commit/9de7abba99383f35a629816acb4c0e48a338cf90))
- push tags to origin with main branch ([e0730d7c](https://github.com/dereekb/dbx-components/commit/e0730d7c856dc7704dde77691cbb7fb0a7cf15b5))
- release tag fix ([fbd18286](https://github.com/dereekb/dbx-components/commit/fbd18286287c74f7de08ded350764cda0fa666a7))
- release tag fix ([49f488bc](https://github.com/dereekb/dbx-components/commit/49f488bc2f8637feb1620a1ec152bc8795920708))
- renamed publish-npmjs to ci-publish-npmjs ([fb62c82f](https://github.com/dereekb/dbx-components/commit/fb62c82f83c637ba01c29c21f8f62bc8a0fb7c44))
- replaced usage of FIREBASE_TOKEN ([9093649b](https://github.com/dereekb/dbx-components/commit/9093649bcde954da335e2aaa39edcffb2076ee01))
- staged builds, single emulator session, cache inputs ([327ef42e](https://github.com/dereekb/dbx-components/commit/327ef42e37a0a3b6a9c61c3362c4461019964362))
- tag deployment fix ([5fbc8903](https://github.com/dereekb/dbx-components/commit/5fbc8903422d062d776c0563189171439fd45de3))
- tag fix ([9eedf1f0](https://github.com/dereekb/dbx-components/commit/9eedf1f0b0f2d429db5511f2b52627abd45d9ce0))
- updated ci deploy ([ca42ba0a](https://github.com/dereekb/dbx-components/commit/ca42ba0aa97854350cdcac7197ee7fbed4c73f3a))
- updated deploy to require approval before deploying ([214a743d](https://github.com/dereekb/dbx-components/commit/214a743dd4c2c70f1afad861fa549be0a22d9b55))
- updated npm publishing order ([10700034](https://github.com/dereekb/dbx-components/commit/10700034b46403b669e437dab7a23561d27783a3))


### Demo

- added bug tests section to demo app ([c1097bfc](https://github.com/dereekb/dbx-components/commit/c1097bfcec5e1f498e782a17303cbb1541f1a833))
- added card example page ([7c0a4c16](https://github.com/dereekb/dbx-components/commit/7c0a4c164c9e338f3f383f5ee1510f67ddbe9395))
- added dbx-anchor-content demo ([dfda4640](https://github.com/dereekb/dbx-components/commit/dfda46405475b2caa1a794244d50dfd330dc3a3b))
- added dbx-two-block demo ([2c439d22](https://github.com/dereekb/dbx-components/commit/2c439d229d5b564f9bfb781e9a978ac459707e81))
- added Directive w/ Forms Example ([e3079e36](https://github.com/dereekb/dbx-components/commit/e3079e3645b2d767b1f305125055eae318175e71))
- added docs for dbxActionSnackbar ([c62679a9](https://github.com/dereekb/dbx-components/commit/c62679a95ab2103ecf7953a4eac2e267481b2877))
- added docs page for action context ([a8cbf38c](https://github.com/dereekb/dbx-components/commit/a8cbf38c631c4c9f837df274192cbb76f861612c))
- added formly expressions demo ([1cb251e5](https://github.com/dereekb/dbx-components/commit/1cb251e56820fa598b54e54ea0161f89ae1170bd))
- added history page for demo purposes ([485a5ddc](https://github.com/dereekb/dbx-components/commit/485a5ddc4054932140a83b4ef33405db7417e792))
- added initial value to pickableItemChipFields demo ([fd79b37d](https://github.com/dereekb/dbx-components/commit/fd79b37dbfe6b2e45da600d17bf5c9761ce0aae8))
- added missing env variables for deployment ([5ceec118](https://github.com/dereekb/dbx-components/commit/5ceec118332273e396fa16cab3a9df8915793fce))
- added placeholder brand image ([9f701638](https://github.com/dereekb/dbx-components/commit/9f70163882686775cf69ea1eafb1e5c7badaa69f))
- added popup with dbxActionPopover details ([3810c7a3](https://github.com/dereekb/dbx-components/commit/3810c7a31ef27386f7f89c2cdee5866ce26e9462))
- added random markers to mapbox demo ([4c4dac74](https://github.com/dereekb/dbx-components/commit/4c4dac74f2b6a5e1267783a482dcc69af850ce33))
- added ripple to DbxValueListGridItemViewComponent ([bccd9fe9](https://github.com/dereekb/dbx-components/commit/bccd9fe982cdefdcbba3b639046a08d83b0d8a77))
- added stripe demo to demo-api ([5ada2594](https://github.com/dereekb/dbx-components/commit/5ada2594299a92f1913380198ed9d1f98dfbf6ae))
- angular 21 convention updates ([42e44f97](https://github.com/dereekb/dbx-components/commit/42e44f97a52b88ab4e88339457a87a1042fe2999))
- cleanup ([dc913090](https://github.com/dereekb/dbx-components/commit/dc913090de80c3c33e9e1d5e588ed89dcdab379b))
- dbx-action directives demo ([63778410](https://github.com/dereekb/dbx-components/commit/6377841017452a1047e6277b46b97a19187d2795))
- dbx-action directives demos ([ca46c98b](https://github.com/dereekb/dbx-components/commit/ca46c98b35019cd0970941912e20cc0760649384))
- fixed api tests ([241de44c](https://github.com/dereekb/dbx-components/commit/241de44cd3bdc5f49ab713cec29e4eb5d1746b5b))
- fixed demo import issue ([e258f1eb](https://github.com/dereekb/dbx-components/commit/e258f1ebbb17747145ba3b88ff4c58596d885bd8))
- fixed mailgun env variables ([3ae1d8c1](https://github.com/dereekb/dbx-components/commit/3ae1d8c1303fbfe263e6dab9da346dcefcd52663))
- icon fix ([78a8ff74](https://github.com/dereekb/dbx-components/commit/78a8ff74052f98ed616a0b5922891a68a6bda7c8))
- landing page ([21109c6b](https://github.com/dereekb/dbx-components/commit/21109c6b5ec58f3e7238453bc11420544b5a4849))
- minor demo changes ([c51837f0](https://github.com/dereekb/dbx-components/commit/c51837f0ea30b7b1c3868745e6a8c76f68fdbb78))
- split value demos into date and other value fields ([5d0aca5c](https://github.com/dereekb/dbx-components/commit/5d0aca5c1ae9ff0023ca25fc74a8798d2eb4819d))
- updated calendar demo to show event clicking ([ae8a600b](https://github.com/dereekb/dbx-components/commit/ae8a600b609a06baa8566ba01065688d93332f12))
- updated calendar items order ([f911f607](https://github.com/dereekb/dbx-components/commit/f911f607fba9f21c7072e516243516a74b79efb0))
- updated demo to test new features ([cef69aeb](https://github.com/dereekb/dbx-components/commit/cef69aebc993f6be8d1dce0b99a19dd540abf4c5))
- updated example cron schedule ([3a4bd2a7](https://github.com/dereekb/dbx-components/commit/3a4bd2a75915ba49530104a77c17b6f7f208e1e1))
- updated landing page package list ([0d384933](https://github.com/dereekb/dbx-components/commit/0d384933337e1f52349e14386de08661fa006180))
- updated marker demo ([5849edd3](https://github.com/dereekb/dbx-components/commit/5849edd34320c7f78b48fd0d0253ba6e96b56005))
- updated markers example ([d759137b](https://github.com/dereekb/dbx-components/commit/d759137b917ca2a756769bf7b1c5555f16e1bfdf))


### Documentation

- added circleci ssh key note to docs ([a8f3d7da](https://github.com/dereekb/dbx-components/commit/a8f3d7daf1f1f43905bcf3903300af306c09b734))
- added dbxActionContextMap docs ([2d437002](https://github.com/dereekb/dbx-components/commit/2d437002c628801823aa6cbfb3681bf7d5d1c304))
- added dbxActionForm page to docs ([6d3ea859](https://github.com/dereekb/dbx-components/commit/6d3ea859735ed7d32cc81f5a1e2e230bfdaabcd7))
- added jsdoc and tests for radix36 encoded ([6eaaf0df](https://github.com/dereekb/dbx-components/commit/6eaaf0df24b6cd402edbc1451357c7af78685c9d))
- added jsdoc annotations to dbx-core ([33f073cd](https://github.com/dereekb/dbx-components/commit/33f073cd0cca27a8aa58fad642012513cdbf0ec3))
- added jsdoc annotations to dbx-web ([d0ba93f2](https://github.com/dereekb/dbx-components/commit/d0ba93f20c68a879be3006941a4345581bfc89ef))
- added jsdoc to dbx-web loading, keypress, util, screen ([069caace](https://github.com/dereekb/dbx-components/commit/069caace0552073b115d41b2228b46f2bc294d1e))
- added jsdocs to zoho and zoho-nestjs packages ([67dee811](https://github.com/dereekb/dbx-components/commit/67dee81121b7f3a6de7d66fea17789d4ac3fdd36))
- added zoho crm getting started guide ([b73308d1](https://github.com/dereekb/dbx-components/commit/b73308d139bdd60eb27e1a5fa3f0294164623a83))
- improved jsdocs for auth.service.ts ([b6dd8e34](https://github.com/dereekb/dbx-components/commit/b6dd8e3459d644d1309ef605387bcbdd41af6bc2))
- jsdoc for firestore driver and supporting modules ([47390b01](https://github.com/dereekb/dbx-components/commit/47390b018c679740127db97b13a2119cf2bb40c8))
- jsdoc improvements across @dereekb/dbx-analytics ([67b5af21](https://github.com/dereekb/dbx-components/commit/67b5af2100706a7845445f2c6d55d231d9cadeed))
- jsdoc improvements across @dereekb/firebase ([e120ae51](https://github.com/dereekb/dbx-components/commit/e120ae5196079c873fa5f141f1ffe717ac7535e7))
- renamed DbComponents to dbx-components ([8438c217](https://github.com/dereekb/dbx-components/commit/8438c217d14e4aa9a1285b8f418a056f7289c07a))
- setup-project docs improvement ([3163d3b6](https://github.com/dereekb/dbx-components/commit/3163d3b60bf8167878a0c4269fee716722d285cb))
- updated root package.json name ([00c89021](https://github.com/dereekb/dbx-components/commit/00c890210b2b5b91c662bf22ecf1e1c321cc3d57))
- updated setup-project.sh to reflect service changes ([7d12d0a3](https://github.com/dereekb/dbx-components/commit/7d12d0a38067392e0617d09507fb09ef1c0a3348))


### Features

- a11y support ([#41](https://github.com/dereekb/dbx-components/issues/41)) ([244b4f4d](https://github.com/dereekb/dbx-components/commit/244b4f4d84884c8659ba05ecb5d0d16d7a15469c)), closes [#41](https://github.com/dereekb/dbx-components/issues/41)
- added @dereekb/nestjs/discord integration ([#36](https://github.com/dereekb/dbx-components/issues/36)) ([4f9bc99e](https://github.com/dereekb/dbx-components/commit/4f9bc99ebba372e0e8bf243b1163f406b48093ba)), closes [#36](https://github.com/dereekb/dbx-components/issues/36)
- added @dereekb/nestjs/openai integration ([611724f3](https://github.com/dereekb/dbx-components/commit/611724f3c5354f2c38a6aecf75a64085f2aa6bcd))
- added @dereekb/nestjs/stripe ([455f20e4](https://github.com/dereekb/dbx-components/commit/455f20e4e6402b3d517e7857fb93ec82eb25817b))
- added @dereekb/util/fetch ([6afa4a48](https://github.com/dereekb/dbx-components/commit/6afa4a48df62791a4b9ee8da67cb8e8bd00d3bcc))
- added AbstractFirebaseNestContext ([2f8e1a21](https://github.com/dereekb/dbx-components/commit/2f8e1a2127ffcfb23a428d6b46192633d8bf725f))
- added additional KeyValueTypleValueFilter values ([715b6150](https://github.com/dereekb/dbx-components/commit/715b6150ee21629667c26c8c90745bb969937482))
- added api proxying and rewrite configuration ([0117dae5](https://github.com/dereekb/dbx-components/commit/0117dae50b12a79fa14b4b0219583b2491800bfe))
- added arrayFactory() ([5a7ef131](https://github.com/dereekb/dbx-components/commit/5a7ef13116ebbacd8b7a9502e3298fd30708f944))
- added arrayToObject() ([edc723f9](https://github.com/dereekb/dbx-components/commit/edc723f94a39f56dd6d43827595ee267830bf897))
- added AsyncPusher ([8cb20525](https://github.com/dereekb/dbx-components/commit/8cb2052577e0901d2acafa3db724b94ab0035b0a))
- added authRolesObsWithClaimsService ([10055ae9](https://github.com/dereekb/dbx-components/commit/10055ae9f4260211b291419134ba637e9f902893))
- added catchAllHandlerKey to handler ([ab93b060](https://github.com/dereekb/dbx-components/commit/ab93b06034dafc27f17cfe3d488ca084b931fabc))
- added cleanup() ([18854634](https://github.com/dereekb/dbx-components/commit/18854634041fcdf613ea8f8b0640db9fb218bbce))
- added clientAppService ([945f3882](https://github.com/dereekb/dbx-components/commit/945f388281d4b9295f2820c39a9e7896ebf4d559))
- added collection group support to dbx-firebase components ([9f746c12](https://github.com/dereekb/dbx-components/commit/9f746c12a0e219970dcde12d920f1ef540514ce9))
- added ContextGrantedModelRolesReader ([6fba1cc6](https://github.com/dereekb/dbx-components/commit/6fba1cc637beeff55523df599eb88391352f9f58))
- added create to FirestoreDocumentDataAccessor ([92119754](https://github.com/dereekb/dbx-components/commit/921197542b80e6fd98245349c9cee98126d6c75b))
- added DateBlock ([b424dc09](https://github.com/dereekb/dbx-components/commit/b424dc09ada622b2c5a85335ce755516eb1fb767))
- added dateScheduleDateFilter() ([ab0e3810](https://github.com/dereekb/dbx-components/commit/ab0e3810f3fc74695dc558a27e9c9d6d45302e1f))
- added DateScheduleDayCode ([0984e331](https://github.com/dereekb/dbx-components/commit/0984e3314d922886c0fbb3cbdc54c306e2577113))
- added dateScheduleRangeField() ([#22](https://github.com/dereekb/dbx-components/issues/22)) ([1979f3b4](https://github.com/dereekb/dbx-components/commit/1979f3b4573315ff4a2b289cc2e645718f33a29c)), closes [#22](https://github.com/dereekb/dbx-components/issues/22)
- added DayOfWeek functions ([16b08bc8](https://github.com/dereekb/dbx-components/commit/16b08bc802124e20b0fc248cc842da6a65d9ca35))
- added dbx-content-pit ([cbce68ad](https://github.com/dereekb/dbx-components/commit/cbce68ad73dc896acc34232e3375698133e99241))
- added dbx-detach interaction type ([39024659](https://github.com/dereekb/dbx-components/commit/390246598dbffb7cc90a754bc8f59bdaa2a389d0))
- added dbx-map-layout ([49550205](https://github.com/dereekb/dbx-components/commit/49550205754cedc9fd431c7d6440f106147e3e0b))
- added dbx-mapbox-menu ([8e310a7e](https://github.com/dereekb/dbx-components/commit/8e310a7ec0908cb345f5277a1bde2a7a31652fa6))
- added dbx-web-mapbox project ([5af3c3b8](https://github.com/dereekb/dbx-components/commit/5af3c3b803db19c401b688d0c3c67ab9da4a1223))
- added dbxActionEnforceModified ([5a4c4b26](https://github.com/dereekb/dbx-components/commit/5a4c4b267f95eda02abccc0fb8a9ae6ab910f738))
- added dbxActionFormDisabledWhileWorking to dbxActionForm ([4d6d67b3](https://github.com/dereekb/dbx-components/commit/4d6d67b3b21b57baefa280ad3a72ac2b281e0a19))
- added dbxActionLoadingContextDirective ([c20aa028](https://github.com/dereekb/dbx-components/commit/c20aa0283c6d248e623f32b2026077e854ada090))
- added dbxAppContextState ([dfc17ebf](https://github.com/dereekb/dbx-components/commit/dfc17ebfd5281dc0d35b9f5347a1f02d8739c171))
- added dbxAppContextStateModule, dbxAppAuthRouterModule ([40fa1fe9](https://github.com/dereekb/dbx-components/commit/40fa1fe9af7ce402e54aac665b9af3c191c9d321))
- added dbxAuthService ([9422182a](https://github.com/dereekb/dbx-components/commit/9422182a617d73b4889ce433aa246962739adaf2))
- added dbxCalendar ([88750cb4](https://github.com/dereekb/dbx-components/commit/88750cb4302b8e67dcaadb4813979a8e73d1d7b7))
- added dbxCalendar Styling ([f9639863](https://github.com/dereekb/dbx-components/commit/f9639863a9cfe599525604c7b8c2d1dcb513ee0d))
- added dbxCoreAuthModule ([29ebf14b](https://github.com/dereekb/dbx-components/commit/29ebf14bc2ce380a7dfafb7d35fd77dfb3d98ea0))
- added DbxErrorWidgetService ([45cd525a](https://github.com/dereekb/dbx-components/commit/45cd525ac45f0337d50c9d6d91f27f4429d63bdf))
- added dbxFirebaseAppCheckHttpInterceptor ([96fb5160](https://github.com/dereekb/dbx-components/commit/96fb5160a8131d4b13e434bcb3e93819122e1d6f))
- added dbxFirebaseAuthModule ([3ab16dff](https://github.com/dereekb/dbx-components/commit/3ab16dffc5dfcaf0d88755c4b8a8d6a3f8c82c19))
- added dbxFirebaseCollectionChangeDirective ([93a38a2b](https://github.com/dereekb/dbx-components/commit/93a38a2be5da3ab5d1bf7905467441fc8b2d563e))
- added dbxFirebaseCollectionStore ([9704c836](https://github.com/dereekb/dbx-components/commit/9704c83603079fe1c58c3961f64d8472ff90bf6d))
- added dbxFirebaseCollectionWithParentStore ([b7045e76](https://github.com/dereekb/dbx-components/commit/b7045e7612326a8fee301a298654f221e3668ab0))
- added DbxFirebaseDevelopmentModule ([f604882d](https://github.com/dereekb/dbx-components/commit/f604882d189f755ba039b8e0ee0a57245410013a))
- added DbxFirebaseDevelopmentSchedulerService ([713bac57](https://github.com/dereekb/dbx-components/commit/713bac57dd1864c52394a16d990f04fc81e0c543))
- added DbxFirebaseDevelopmentSchedulerWidgetComponent ([99c57122](https://github.com/dereekb/dbx-components/commit/99c57122976a6afefbd2a458819861ce47c6ec60))
- added DbxFirebaseDocumentLoaderInstance ([523d1dff](https://github.com/dereekb/dbx-components/commit/523d1dff22ac979b75bd310677770665ec76ff63))
- added dbxFirebaseDocumentStore ([43da785b](https://github.com/dereekb/dbx-components/commit/43da785b1b271549f65273a56a0c333a0a23bb2e))
- added dbxFirebaseDocumentWithParentStore ([f055d81a](https://github.com/dereekb/dbx-components/commit/f055d81aadc8df852640e7997368af73be05b654))
- added dbxFirebaseFunctionsModule ([3d1bc695](https://github.com/dereekb/dbx-components/commit/3d1bc69552e0a3cede0261d4819ad35199a03fa3))
- added dbxFirebaseLoginModule ([bf99f2d9](https://github.com/dereekb/dbx-components/commit/bf99f2d947bedc2305e82e1d8cf0ecc6bb9a1f0f))
- added DbxFirebaseModelHistoryPopoverButtonComponent ([ce8a720b](https://github.com/dereekb/dbx-components/commit/ce8a720bb600814e8ae695c8067323545d60de25))
- added dbxFirebaseModelLoaderModule ([15a8052e](https://github.com/dereekb/dbx-components/commit/15a8052e057fa6e5691915ab81b5fe8b4afdfa95))
- added DbxFirebaseModelTypesService ([d711abba](https://github.com/dereekb/dbx-components/commit/d711abba56b507fa53e5a907d104717ac68106ca))
- added DbxFirebaseStorageService ([deeaa029](https://github.com/dereekb/dbx-components/commit/deeaa02908f4acb754afc52d42033734bd034924))
- added DbxFormMapboxLatLngFieldComponent ([5ce4fbb4](https://github.com/dereekb/dbx-components/commit/5ce4fbb470b056c5a92da119cc29fd867ca7fe60))
- added dbxFormWorkingWrapperComponent ([fd32cd4c](https://github.com/dereekb/dbx-components/commit/fd32cd4c2933e79c255f07f86fdc8fc3029b0858))
- added dbxInjectionContext ([a6ac8010](https://github.com/dereekb/dbx-components/commit/a6ac80106cd78371391c1a314364997bf974194c))
- added DbxItemListFieldComponent ([467a8799](https://github.com/dereekb/dbx-components/commit/467a879934737cdfd18c9211ee775c4990ac502a))
- added dbxListItemDisableRippleModifier ([c89cc82b](https://github.com/dereekb/dbx-components/commit/c89cc82b618ae3513c716d09c1e721b8c32e16c6))
- added dbxListItemIsSelectedModifier ([7dea240f](https://github.com/dereekb/dbx-components/commit/7dea240f3d8efc4c55b03877d5662aa8c89c5992))
- added dbxListItemModifier, dbxListItemAnchorModifier ([a96ffa8e](https://github.com/dereekb/dbx-components/commit/a96ffa8e87b49b4408c917b6480d139dc748d8e4))
- added dbxListTitleGroup for list views ([356b94b9](https://github.com/dereekb/dbx-components/commit/356b94b963ef290820915c25562323b27b3449b1))
- added DbxMapboxMapStore ([9397b9a5](https://github.com/dereekb/dbx-components/commit/9397b9a5951abe909d4539176d266c2934189034))
- added DbxPresetMenuFilter ([2c08ad79](https://github.com/dereekb/dbx-components/commit/2c08ad79e464dac307d0dd347487b4e7d3d75a6b))
- added dbxProgressButtons ([004ada21](https://github.com/dereekb/dbx-components/commit/004ada21ecb9c92325e76222adf8fc6a0762cad4))
- added DbxRouteParamDefaultInstance ([26085806](https://github.com/dereekb/dbx-components/commit/26085806ff2578ce2864140fc78e883b399c05e9))
- added DbxRouteParamReader ([a8552835](https://github.com/dereekb/dbx-components/commit/a8552835aabbfa85814984a8fdafd7bd1fb2963e))
- added DbxValueListGridViewComponent ([cca9a62d](https://github.com/dereekb/dbx-components/commit/cca9a62d078e9fc4a710aea5bb834eb22a7b952d))
- added DbxWidgetViewComponent ([6cf8d3a7](https://github.com/dereekb/dbx-components/commit/6cf8d3a701b84ada9db735de5d08d3967debb1a2))
- added describeCloudFunctionTest() to handle a map of functions ([55451495](https://github.com/dereekb/dbx-components/commit/55451495c305726d89973613d7d5b9a5be9871bc))
- added duplicate button to repeatArrayField ([f4e027b9](https://github.com/dereekb/dbx-components/commit/f4e027b9b30a9875581b262cee4547e80ba2e791))
- added exists(), uploadStream(), getBytes(), getStream() ([e3fe97e5](https://github.com/dereekb/dbx-components/commit/e3fe97e5e985125a5ca653c40fd79c7980845863))
- added filterByMapboxViewportBound() ([a6beb56a](https://github.com/dereekb/dbx-components/commit/a6beb56abf9d546eb00de2e7601316f80ccb925e))
- added firebase appCheck support to client ([e9377d16](https://github.com/dereekb/dbx-components/commit/e9377d16faa12a9d45f7a34fda97946b9bf008bd))
- added firebase emulator data importing/exporting for persistence ([8739ba5b](https://github.com/dereekb/dbx-components/commit/8739ba5b84881ec1a51bd9034c97d072d17a1828))
- added firebase functions v2 nest context components ([e5ca8925](https://github.com/dereekb/dbx-components/commit/e5ca89250c7b7cf99f75d8edb0fc16a4618cbc21))
- added firebase scheduled tasks ([2114446a](https://github.com/dereekb/dbx-components/commit/2114446acb1704e93cabd2933d5876f8d9adb56a))
- added firebase storage testing/mock components ([a2524b79](https://github.com/dereekb/dbx-components/commit/a2524b79b50551ed97186c6cb2692bb072d7af48))
- added firebase-server ([676cf9e6](https://github.com/dereekb/dbx-components/commit/676cf9e6c44aab5ca993b5a1a9c347c021b41a4a))
- added FirebaseAppCheckMiddleware ([25ddc4e7](https://github.com/dereekb/dbx-components/commit/25ddc4e7ae18d6ef96c38ed529c71313884b7544))
- added firebaseDocumentStoreReadFunction() ([f2fd7eef](https://github.com/dereekb/dbx-components/commit/f2fd7eef3b088a615b9226231fde3342676f4f64))
- added FirebaseModelService ([38765755](https://github.com/dereekb/dbx-components/commit/387657559a86908eee57326b655c63a0a836c239))
- added FirebaseModelsPermissionService ([9d75de40](https://github.com/dereekb/dbx-components/commit/9d75de4052dcfb15ef680d30f476ef494d8328a9))
- added firebaseModelsService ([7432e551](https://github.com/dereekb/dbx-components/commit/7432e55111cec66a239856ecb2db6adfc9e9780d))
- added firebaseQueryItemAccumulator ([1e4e0f36](https://github.com/dereekb/dbx-components/commit/1e4e0f367a4bdc9dac7366ae9421e9ec48279b92))
- added firebaseServerDevFunctions() ([375e3acf](https://github.com/dereekb/dbx-components/commit/375e3acf4e7539bdca37c68b50617ea455690d69))
- added FirebaseServerNewUserService ([10d64dc1](https://github.com/dereekb/dbx-components/commit/10d64dc137e533a62d7449709a93056741a840e4))
- added FirebaseServerStorageService ([38bf98aa](https://github.com/dereekb/dbx-components/commit/38bf98aa76aaddcd0ae2a9487b9a661f7f9f4e6e))
- added FirebaseStorageContext ([5a30d465](https://github.com/dereekb/dbx-components/commit/5a30d465181d91ce92e7405636fb5414787ac8aa))
- added firebaseStorageContextFactory ([e9405795](https://github.com/dereekb/dbx-components/commit/e9405795092fe4bc403967a93e0bff3a55fdd278))
- added firestore collection group support ([3b4c4cfa](https://github.com/dereekb/dbx-components/commit/3b4c4cfa1dd860604c347ade69acdc2fea1063f8))
- added Firestore Increment support ([d4dc97b9](https://github.com/dereekb/dbx-components/commit/d4dc97b92d4c592713019b1089a6ba8bacfc93be))
- added firestore key validators ([9d090db1](https://github.com/dereekb/dbx-components/commit/9d090db1e84b97f11cc2b751dcbe7d2724960b2b))
- added firestoreArray ([e8522307](https://github.com/dereekb/dbx-components/commit/e85223077246c1755cdb1028deea7019a6c71206))
- added firestoreDocumentAccessor path validation ([775c66b9](https://github.com/dereekb/dbx-components/commit/775c66b94af4abb644f7296c8d68cd9dd09601c6))
- added FirestoreDocumentStore crud functions ([7786a40f](https://github.com/dereekb/dbx-components/commit/7786a40f6033c2a1d5161805cde283dca7323db5))
- added firestoreEncodedArray, firestoreUniqueArray ([4f7fc7ca](https://github.com/dereekb/dbx-components/commit/4f7fc7ca274656ecdf13d69aa7d225f66a7f76da))
- added firestoreEnum() ([28e67041](https://github.com/dereekb/dbx-components/commit/28e670414f87eb538e996c5d823b5f79e9d9ae97))
- added firestoreEnumArray() ([5f9e1b14](https://github.com/dereekb/dbx-components/commit/5f9e1b14237ff229a4a832b8fbd5f13a21f753a6))
- added firestoreIdBatchVerifierFactory() ([182f086f](https://github.com/dereekb/dbx-components/commit/182f086f80671fa38ed1268a6c98854f114ba629))
- added firestoreLatLngString() ([2af3e5fc](https://github.com/dereekb/dbx-components/commit/2af3e5fcbcae665994df5cc68d1c246b5417a07d))
- added FirestoreMap, FirestoreArrayMap snapshot fields ([bd23fd37](https://github.com/dereekb/dbx-components/commit/bd23fd372e3f2180980d7aec9c1b6ee1ec2bb3c7))
- added FirestoreObjectArray ([e1050eb5](https://github.com/dereekb/dbx-components/commit/e1050eb53c816025e016a07e2d7e41ee8c24362a))
- added firestoreSubObjectField() ([3d6fbe17](https://github.com/dereekb/dbx-components/commit/3d6fbe17a10dfddf3e9bc1cecd522ed61efd6c49))
- added fixedDateRangeField() ([ff214ee0](https://github.com/dereekb/dbx-components/commit/ff214ee066c524fb0a6f5b1638ecbffdee53e985))
- added function builders for object filters ([c01db204](https://github.com/dereekb/dbx-components/commit/c01db2045412d513ae804f9a2d6154a267aae7cb))
- added functionsRegionOrCustomDomain configuration ([e27df0df](https://github.com/dereekb/dbx-components/commit/e27df0dfd8ecf58b7e5f122189d4405f50a7f731))
- added getDocumentSnapshotsData() ([dc263409](https://github.com/dereekb/dbx-components/commit/dc26340972df9f1a7a8b8767e2929ca956e9e4a5))
- added getWithConverter() ([aef4b27d](https://github.com/dereekb/dbx-components/commit/aef4b27dabfa926af098d5c1afac4fb77302b4ef))
- added grantedRoleMapReader ([11d2f178](https://github.com/dereekb/dbx-components/commit/11d2f1786f06024dfbbbfd9ac00e48791cbc0521))
- added grantFullAccessIfAuthUserRelated() ([be05e093](https://github.com/dereekb/dbx-components/commit/be05e0939939e9e0d1c8d1d8afbcab1fb15e060b))
- added grantModelRolesIfFunction and related types ([5432fab1](https://github.com/dereekb/dbx-components/commit/5432fab1677c29e24eac4015c35821aba2d64e10))
- added handlerFunction ([7cd25174](https://github.com/dereekb/dbx-components/commit/7cd25174d273f8e501e13ca02607a8c743adb939))
- added idBatchFactory() ([b39510b7](https://github.com/dereekb/dbx-components/commit/b39510b7b617e927da48efe03b3121f74fe192e8))
- added ignore to AuthRoleClaimsFactoryConfig ([71e3caca](https://github.com/dereekb/dbx-components/commit/71e3cacad2ba211e5d64c4c60d8c62799b570fed))
- added InModelContextFirebaseModelServiceFactory ([9bf46973](https://github.com/dereekb/dbx-components/commit/9bf469731699a16ad27c96e3b149f552a429b471))
- added interceptAccessorFactory() ([98335398](https://github.com/dereekb/dbx-components/commit/98335398eaa6a3ee363bdf64a440d5438bbefb24))
- added isAdminOrTargetUserInRequestData() ([c597eb9c](https://github.com/dereekb/dbx-components/commit/c597eb9ce968ae5e8d64f3bc2f6ba6520cb11681))
- added isAllowed ([c2a70bf8](https://github.com/dereekb/dbx-components/commit/c2a70bf8a6f4bc4ef8b870691b9899fed3cbafad))
- added IsDateWithinDateBlockRangeFunction ([994c6b1a](https://github.com/dereekb/dbx-components/commit/994c6b1a018bfb81801775b2901c565aab1d52c8))
- added IsWithinLatLngBoundFunction() ([c986e5bf](https://github.com/dereekb/dbx-components/commit/c986e5bfe1742319526f0d1ec62e3c3a09c47d2d))
- added IterationQueryChangeWatcher ([f5b2474f](https://github.com/dereekb/dbx-components/commit/f5b2474f9a2cf659cdebf19ba49055e5bd2f1c90))
- added jest fail test utilities ([#13](https://github.com/dereekb/dbx-components/issues/13)) ([58917774](https://github.com/dereekb/dbx-components/commit/5891777470a339892c8e7045c24b5dea174b1736)), closes [#13](https://github.com/dereekb/dbx-components/issues/13)
- added jestFunctionFixture ([1ea2d7d4](https://github.com/dereekb/dbx-components/commit/1ea2d7d4c852449f34279eeedfadd2d69c1e7f2b))
- added list() and list exists() ([388c5935](https://github.com/dereekb/dbx-components/commit/388c59350897fcc42d61eb723896e23c42211507))
- added loadDocumentForId() to FirestoreDocumentAccessor ([37281454](https://github.com/dereekb/dbx-components/commit/372814540064ff4b40be032d57ddda12a8698d53))
- added loadDocumentForKey to LimitedFirestoreDocumentAccessor ([96958b89](https://github.com/dereekb/dbx-components/commit/96958b89df62dc38136ac2dfcd2ce7c139b6099e))
- added makeWithFactory() ([4a6f4a01](https://github.com/dereekb/dbx-components/commit/4a6f4a01a04e7800653bc942fe56b27ec457813e))
- added Mapbox functions to DbxMapboxStore ([9a9f5f4a](https://github.com/dereekb/dbx-components/commit/9a9f5f4a22088be4a5c170dffe6cc2eb9f66731b))
- added mapboxZoomField() ([9ab35748](https://github.com/dereekb/dbx-components/commit/9ab357482d475b5410927e8a3b71c54c26f225b5))
- added mapKeysIntersection utility functions ([f694f86b](https://github.com/dereekb/dbx-components/commit/f694f86b87e646e00e446236bb1c94a28652aa70))
- added modelConversionFunctions ([42050a8c](https://github.com/dereekb/dbx-components/commit/42050a8c1561acad97e99d540834d9c1305ca897))
- added modelConversionOptions to modelMapFunction ([2de30e07](https://github.com/dereekb/dbx-components/commit/2de30e07527bbaf27c51a8472054a35e73d2ae2b))
- added ModelModifier ([118bde78](https://github.com/dereekb/dbx-components/commit/118bde78f04162f5dcad5d64feef2efb42c62d65))
- added modelTestContextFactory ([0a964425](https://github.com/dereekb/dbx-components/commit/0a9644252ffc670cb2e861a4c02ace6790eeae52))
- added modelType to FirestoreDocument ([deecb5df](https://github.com/dereekb/dbx-components/commit/deecb5df415ed9d99412c336ba65f4da572bbe44))
- added nginx docker configuration for webhooks ([9425016e](https://github.com/dereekb/dbx-components/commit/9425016eb5d497144d88dccf2a715b795dcc47ae))
- added NotificationExpediteService ([bdfc0b35](https://github.com/dereekb/dbx-components/commit/bdfc0b35f11d3f60f0daa5fd4522f31da593f7d7))
- added now to dbxDateTimeFieldComponent ([812e704b](https://github.com/dereekb/dbx-components/commit/812e704b9bf44daa7441f236d6fe1e2c499ec7dd))
- added number field ([387b0025](https://github.com/dereekb/dbx-components/commit/387b002509a2409c707d098512540add06a7b86a))
- added Observable to ValueSelectionFieldConfig ([235c2de9](https://github.com/dereekb/dbx-components/commit/235c2de9a1e0a7b40981cbe935038d379270f8ca))
- added oidc-provider ([#37](https://github.com/dereekb/dbx-components/issues/37)) ([be49c483](https://github.com/dereekb/dbx-components/commit/be49c4833ec3bfe71c1239f8b2eee3663e7320d9)), closes [#37](https://github.com/dereekb/dbx-components/issues/37)
- added onCallCreateModel ([84f7e72a](https://github.com/dereekb/dbx-components/commit/84f7e72af20c1d0071feec3e46bae406d7fd5a26))
- added OnCallDeleteModel ([358189d6](https://github.com/dereekb/dbx-components/commit/358189d6db6ef7d8db93d6dd881d29cc724dd083))
- added OnCallReadModelFunction ([4c0eeb93](https://github.com/dereekb/dbx-components/commit/4c0eeb938ba409d66ec5d049ef01802084c1a459))
- added OnCallUpdateModel ([3b60a06d](https://github.com/dereekb/dbx-components/commit/3b60a06d48ec6a96940f44939e24e5c1f4879aa9))
- added onCallWithNestContext to firebase-server ([ad4fcf80](https://github.com/dereekb/dbx-components/commit/ad4fcf80e71e7b954197dd89924d31180c03c911))
- added onMatchDelta ([e36fb4c4](https://github.com/dereekb/dbx-components/commit/e36fb4c47c82ef7a616b7d3b12888e370206a2e5))
- added orderByDocumentId, startAtValue, endAtValue constraints ([c846feef](https://github.com/dereekb/dbx-components/commit/c846feef6c26a3818bb006a807b6e931b7b14eaf))
- added overrideInObjectFunctionFactory, mergeObjectsFunction ([4ea7d656](https://github.com/dereekb/dbx-components/commit/4ea7d6569e6aed0838cdf7218fd63824ff5a7b98))
- added performBatchLoop() ([7c6c9475](https://github.com/dereekb/dbx-components/commit/7c6c9475eacfd3cc7f153ef949fef1187925a8cb))
- added redirectForUserIdentifierParamHook ([0f8467d9](https://github.com/dereekb/dbx-components/commit/0f8467d928200b35b10484dafe5bf5a6aff7d455))
- added sass extension configuration ([5b3b33ea](https://github.com/dereekb/dbx-components/commit/5b3b33ea3b542690c6e75242fa5186872f6599ef))
- added searchStringFilterFunction() ([f91aaafb](https://github.com/dereekb/dbx-components/commit/f91aaafb7fc4c304fbbd7fc2a3d471c4573ebdf3))
- added setContainsAllValues ([737c1e75](https://github.com/dereekb/dbx-components/commit/737c1e750a9c656406043e2a69bdceaf941750b6))
- added setContainsAnyValue() ([ea0ee9a7](https://github.com/dereekb/dbx-components/commit/ea0ee9a76fc6b093b2608356179e9f633fc896be))
- added SlashPath ([8c902ab0](https://github.com/dereekb/dbx-components/commit/8c902ab0eb379783320f8a9375486a4e9ce0cd44))
- added snapshotConverter, firestoreField ([e986026a](https://github.com/dereekb/dbx-components/commit/e986026a4a4700c734fe1534778945df189c518d))
- added specifier for crud functions ([39e366e0](https://github.com/dereekb/dbx-components/commit/39e366e09936b5963cd3e74bc127ad3146d14ef7))
- added step, enforceStep to numberField ([a57b1c7f](https://github.com/dereekb/dbx-components/commit/a57b1c7f9f0194874e4dcadafabf01ee49d44c48))
- added StorageFile ([#30](https://github.com/dereekb/dbx-components/issues/30)) ([1c00f024](https://github.com/dereekb/dbx-components/commit/1c00f0242fa40548ced24799c277acfe5c9ee3bb)), closes [#30](https://github.com/dereekb/dbx-components/issues/30)
- added StorageFileGroup ([#31](https://github.com/dereekb/dbx-components/issues/31)) ([14be9c3f](https://github.com/dereekb/dbx-components/commit/14be9c3f513c27fa1a445e99791050625f174844)), closes [#31](https://github.com/dereekb/dbx-components/issues/31)
- added string functions ([1866db58](https://github.com/dereekb/dbx-components/commit/1866db58d96a1d893d01ff2890a9bccb38e2ca61))
- added SystemStateDocument ([d4a0fcf5](https://github.com/dereekb/dbx-components/commit/d4a0fcf53e4e98c91ec8915e9122b7af9ded35f7))
- added timezonePicker() ([a1b23c03](https://github.com/dereekb/dbx-components/commit/a1b23c03f742b20c3f8b631ee9a17730d16b9335))
- added transformAndValidateObject ([1f660941](https://github.com/dereekb/dbx-components/commit/1f6609413b85ae1a2b851a70bc2190ff66c7b467))
- added upload byte types, delete() ([655088b2](https://github.com/dereekb/dbx-components/commit/655088b238ef80097a2f09c539a1282a608f246b))
- added useAsObservable() ([a0e363d1](https://github.com/dereekb/dbx-components/commit/a0e363d101c03918ea1d688943d4091f29dde3eb))
- added UseAsync ([f52ff345](https://github.com/dereekb/dbx-components/commit/f52ff345621ecbcb4d6b0f2957dcd7f4f901ac3a))
- added useDocumentSnapshotData ([aa329f25](https://github.com/dereekb/dbx-components/commit/aa329f25cb105c871bc0fb22001abb7a98979b14))
- added UseFunction, MappedUseFunction ([84b6cbe2](https://github.com/dereekb/dbx-components/commit/84b6cbe23b7e020ad7de49633642429d7e32f7d4))
- added useModel to AbstractFirebaseNestContext ([29c19402](https://github.com/dereekb/dbx-components/commit/29c19402bff78d743d28ef88093757844f8ee5f7))
- added valueSelectionField() ([2392a1b9](https://github.com/dereekb/dbx-components/commit/2392a1b90a12f521945af214499484cc99c2d037))
- added vapi.ai integration ([c06f5e88](https://github.com/dereekb/dbx-components/commit/c06f5e886369ad5da2712b667346b5cbf7161845))
- added WebsiteFileLink ([dc58b5c3](https://github.com/dereekb/dbx-components/commit/dc58b5c3a78c1e6fbf3ee065b02b270f15f4dc79))
- added WebsiteLink ([68eda11f](https://github.com/dereekb/dbx-components/commit/68eda11f78f96c3f875bbd69fdc856b4164ea7a3))
- added WebsiteUrl and functions ([ed3430f7](https://github.com/dereekb/dbx-components/commit/ed3430f7caba109fbcb9fc02764c22d3ee686fc4))
- added whereDocumentId() ([7f5f5b8a](https://github.com/dereekb/dbx-components/commit/7f5f5b8a56b2e0ad2e43308cfd87b4f8b8503c59))
- added wrapUseFunction() ([7bbae2fd](https://github.com/dereekb/dbx-components/commit/7bbae2fdcbf8344c04c5c26db1d5a40b8048985b))
- angular 18 ([#28](https://github.com/dereekb/dbx-components/issues/28)) ([c8f54720](https://github.com/dereekb/dbx-components/commit/c8f5472026b47c8877f404a9c87bf7a3fa68b45b)), closes [#28](https://github.com/dereekb/dbx-components/issues/28)
- angular material m3 ([#40](https://github.com/dereekb/dbx-components/issues/40)) ([ad91169d](https://github.com/dereekb/dbx-components/commit/ad91169d28118e63e4a2108d0e4d27cc7eda8a27)), closes [#40](https://github.com/dereekb/dbx-components/issues/40)
- arktype migration ([#35](https://github.com/dereekb/dbx-components/issues/35)) ([fe87948b](https://github.com/dereekb/dbx-components/commit/fe87948bf30948352a55db18b0057bcd1b4673ee)), closes [#35](https://github.com/dereekb/dbx-components/issues/35)
- cal.com integration ([#38](https://github.com/dereekb/dbx-components/issues/38)) ([16800338](https://github.com/dereekb/dbx-components/commit/16800338c26da4deeb4834f62f0e09f1a24c1454)), closes [#38](https://github.com/dereekb/dbx-components/issues/38)
- callModel api ([#42](https://github.com/dereekb/dbx-components/issues/42)) ([a0a05fd5](https://github.com/dereekb/dbx-components/commit/a0a05fd549d927548dd7569067828dbe62d90ae8)), closes [#42](https://github.com/dereekb/dbx-components/issues/42)
- codedError now includes original error if available ([1262281f](https://github.com/dereekb/dbx-components/commit/1262281f08b75000f863b483744418378006b2d2))
- date query builder ([9adfe56b](https://github.com/dereekb/dbx-components/commit/9adfe56b15ae2ebd1e938ec33d971f410d7ec373))
- DateCellTiming ([#24](https://github.com/dereekb/dbx-components/issues/24)) ([aed9ef56](https://github.com/dereekb/dbx-components/commit/aed9ef56fdd0438a7a4ba90da79d6a20465bbdfd)), closes [#24](https://github.com/dereekb/dbx-components/issues/24)
- dbx-cli ([#48](https://github.com/dereekb/dbx-components/issues/48)) ([96a2d505](https://github.com/dereekb/dbx-components/commit/96a2d5057450fadf9562fd251e9496fe6d94234c)), closes [#48](https://github.com/dereekb/dbx-components/issues/48)
- dbx-components-mcp ([#47](https://github.com/dereekb/dbx-components/issues/47)) ([e68b16a6](https://github.com/dereekb/dbx-components/commit/e68b16a66018a307ef55a4ef9cbccec6657128d8)), closes [#47](https://github.com/dereekb/dbx-components/issues/47) [hi#complexity](https://github.com/dereekb/hi/issues/complexity) [Array#sort](https://github.com/dereekb/Array/issues/sort) [Array#push](https://github.com/dereekb/Array/issues/push) [Array#push](https://github.com/dereekb/Array/issues/push) [hi#complexity](https://github.com/dereekb/hi/issues/complexity) [#47](https://github.com/dereekb/dbx-components/issues/47) [Array#at](https://github.com/dereekb/Array/issues/at)
- dbx-table ([#23](https://github.com/dereekb/dbx-components/issues/23)) ([46615089](https://github.com/dereekb/dbx-components/commit/466150895b5bdc6e9e5289ef38ef5dd3e0ae67f9)), closes [#23](https://github.com/dereekb/dbx-components/issues/23)
- dbxActionDialogDirective ([63fb8717](https://github.com/dereekb/dbx-components/commit/63fb8717ea1213b602e34640ec1be81d6ca14098))
- dbxActionPopoverDirective ([a808ac9a](https://github.com/dereekb/dbx-components/commit/a808ac9a7b62841311d63df1d1ee55e57876f47f))
- dbxSelectionListViewContent can render as dbxListViewContent ([df162977](https://github.com/dereekb/dbx-components/commit/df1629777ec02f3ac96fa0fbcbaa1d4565f7095c))
- firebase-server analytics ([#39](https://github.com/dereekb/dbx-components/issues/39)) ([cf3b17e4](https://github.com/dereekb/dbx-components/commit/cf3b17e4c70dd06827f9ebf0d05292fc6e8b48bc)), closes [#39](https://github.com/dereekb/dbx-components/issues/39)
- firebaseServerAuthModule ([db9a4d3d](https://github.com/dereekb/dbx-components/commit/db9a4d3d47fd15317186c7a034c25083ae395251))
- firestoreModeIdentity can now accept a collection name ([1e0646e5](https://github.com/dereekb/dbx-components/commit/1e0646e598a0834d8b4c3d264bb5ee42626e9fc7))
- improved serve-server ([0e6fb186](https://github.com/dereekb/dbx-components/commit/0e6fb186add4dc003660d4501200de40ca911b20))
- mailgun ([#16](https://github.com/dereekb/dbx-components/issues/16)) ([9c7d4cc9](https://github.com/dereekb/dbx-components/commit/9c7d4cc997e86b664ff7e2bc6e04392e650b7910)), closes [#16](https://github.com/dereekb/dbx-components/issues/16)
- ng-forge ([#43](https://github.com/dereekb/dbx-components/issues/43)) ([66dda79b](https://github.com/dereekb/dbx-components/commit/66dda79bdedd1f0940ef2fec01b2cd0b1516a97f)), closes [#43](https://github.com/dereekb/dbx-components/issues/43)
- notification tasks ([60e99591](https://github.com/dereekb/dbx-components/commit/60e995919b14d3262191cbeedc26a169c179ff24))
- notifications ([#27](https://github.com/dereekb/dbx-components/issues/27)) ([d83bdc3c](https://github.com/dereekb/dbx-components/commit/d83bdc3c2f308a25cc4cb12e6eedd126e91c46a4)), closes [#27](https://github.com/dereekb/dbx-components/issues/27)
- nx16 and Angular 16 migration ([#25](https://github.com/dereekb/dbx-components/issues/25)) ([fc03da8e](https://github.com/dereekb/dbx-components/commit/fc03da8e7ac159e559e4d1379a277148b51a2504)), closes [#25](https://github.com/dereekb/dbx-components/issues/25)
- refactored dbxFormSource ([aad115d9](https://github.com/dereekb/dbx-components/commit/aad115d9809ed765ddadc63c9f56ac2a4ab5ce5a))
- setup project ([fe2ae885](https://github.com/dereekb/dbx-components/commit/fe2ae88592c4a02c0346e5e31c72e3d66fb08845))
- sourceselect field ([d0875f51](https://github.com/dereekb/dbx-components/commit/d0875f5188161aec0f669a1bfed0ebe227d0d69a))
- updated .env deployment to demo-api ([d88ea620](https://github.com/dereekb/dbx-components/commit/d88ea620c9593e0073f323f4536bcccd2de01e2f))
- updated @ngx-formly to 6.0.0-beta.2 ([6f1737ab](https://github.com/dereekb/dbx-components/commit/6f1737ab61473497b4c69c097b9f87da3f881c74))
- updated FirebaseServerAuthUserContext to be synchronous ([92bfd849](https://github.com/dereekb/dbx-components/commit/92bfd849b4a6d6773c616069c3085b686938ef4d))
- updated firestoreModelKey() ([1459a150](https://github.com/dereekb/dbx-components/commit/1459a150b00cd657cc5a835652c17945ae85ca15))
- updated to angular 14 ([#15](https://github.com/dereekb/dbx-components/issues/15)) ([739726ea](https://github.com/dereekb/dbx-components/commit/739726eabdf49007b096dbb892054887268c7732)), closes [#15](https://github.com/dereekb/dbx-components/issues/15)
- zoho crm ([#32](https://github.com/dereekb/dbx-components/issues/32)) ([abe424b4](https://github.com/dereekb/dbx-components/commit/abe424b4ee58cef605a29a5839a2e36d22d24866)), closes [#32](https://github.com/dereekb/dbx-components/issues/32)
- zoho desk, zoho cli ([#45](https://github.com/dereekb/dbx-components/issues/45)) ([eab5b5a7](https://github.com/dereekb/dbx-components/commit/eab5b5a7e5ab31d897ecf9454b32e55e80191517)), closes [#45](https://github.com/dereekb/dbx-components/issues/45)
- zoho recruit ([#26](https://github.com/dereekb/dbx-components/issues/26)) ([8e028fd6](https://github.com/dereekb/dbx-components/commit/8e028fd6fc57fb276ce04d37ce010fb5a42d4157)), closes [#26](https://github.com/dereekb/dbx-components/issues/26)
- zoom api ([#29](https://github.com/dereekb/dbx-components/issues/29)) ([555a82a3](https://github.com/dereekb/dbx-components/commit/555a82a321c82884d51bcff8bd54ad8c7b4e9f17)), closes [#29](https://github.com/dereekb/dbx-components/issues/29)


### Minor Changes

- added .dbx-list-two-line-item ([cfa2adb0](https://github.com/dereekb/dbx-components/commit/cfa2adb037a5cb4168fe3e7432302d31369730b3))
- added .dbx-section-page-header-search-bar ([797989a4](https://github.com/dereekb/dbx-components/commit/797989a49afbe7f5bfbf001a355199092a64e46c))
- added .dbx-section-page-header-search-form ([5e1e6911](https://github.com/dereekb/dbx-components/commit/5e1e6911723342a926e8bed4026f8df27abe213c))
- added .gitattributes ([f5434335](https://github.com/dereekb/dbx-components/commit/f54343353a068dd97ebc15119a4b4b03af1f9ab7))
- added AbstractMailgunContentFirebaseServerNewUserService ([d9095b06](https://github.com/dereekb/dbx-components/commit/d9095b066debe6cc41eb0cb06a17f07f76b123c4))
- added additional function errors ([efcf12ac](https://github.com/dereekb/dbx-components/commit/efcf12ac2517ce4197427aa61d92c0cca1db20ac))
- added additional loadDocuments utility functions ([f600a085](https://github.com/dereekb/dbx-components/commit/f600a08522cf7a3a40fd3799f76b22400aada983))
- added address-related classes with validation ([706ba029](https://github.com/dereekb/dbx-components/commit/706ba029e18954a112b87e3a4649f0bb6f2ab6e7))
- added allChildDocumentsUnderRelativePath() ([2d74c1b1](https://github.com/dereekb/dbx-components/commit/2d74c1b15d6f35bb9a47f4de6c28b0afc0a18416))
- added assertDocumentExists() ([a60edf39](https://github.com/dereekb/dbx-components/commit/a60edf39f73efe7fa9f6b815ea9dd8b9fd316067))
- added assertHasRolesInRequest() ([b54b7bc0](https://github.com/dereekb/dbx-components/commit/b54b7bc0e06372955c733f146dfc1d270e1fbe1f))
- added assertSnapshotData ([d75713c3](https://github.com/dereekb/dbx-components/commit/d75713c32595a23d451c19a19ef940f46f57e711))
- added calendar month to DateRangeType ([ed2ac93e](https://github.com/dereekb/dbx-components/commit/ed2ac93ecbdc7c3ece6fc27fccb2359b42726816))
- added classes for DateBlock, DateRange ([3b70ae93](https://github.com/dereekb/dbx-components/commit/3b70ae934b66785e2c3395c7c0659093226d07e6))
- added clickableUrlInNewTab() ([a7582a36](https://github.com/dereekb/dbx-components/commit/a7582a365f1c6ba8443d346c084a0405f020eb47))
- added clickableUrlMailTo(), clickableUrlTel() ([b5b6a16f](https://github.com/dereekb/dbx-components/commit/b5b6a16f6cdfc978244293508cf6a4f3648c71d1))
- added color to dbx-content-border ([25c98102](https://github.com/dereekb/dbx-components/commit/25c981029642785dd9df522ec85323e583f691ad))
- added combineLatestFromObject() ([b685f126](https://github.com/dereekb/dbx-components/commit/b685f1264bffe1c86ec73155b0d7ad335aee84ca))
- added constraint templates for date searching ([8243d255](https://github.com/dereekb/dbx-components/commit/8243d2559b691a641947d5413807a41170fc8623))
- added currentAuthContextInfo$ to DbxFirebaseAuthService ([9d8d37a6](https://github.com/dereekb/dbx-components/commit/9d8d37a601bb4e95d0969f024523f017806a83e2))
- added currentExists$ to DbxFirebaseDocumentStore ([07f0a701](https://github.com/dereekb/dbx-components/commit/07f0a701fac66e2dc741412af7da6ce62ddf0dea))
- added dateBlockDateOfWeekFactory() ([2afe2bd9](https://github.com/dereekb/dbx-components/commit/2afe2bd9638f47ce87e387f0fb329c5ba9327d34))
- added dateBlockRangeBlocksCount() ([a883e6aa](https://github.com/dereekb/dbx-components/commit/a883e6aa1616d2f9c5f80be6fdbdc31d443c1111))
- added dateBlockRangesFullyCoverDateBlockRangeFunction() ([072e4193](https://github.com/dereekb/dbx-components/commit/072e4193386ea7ef1cc17602c4b3db5f8f3e484a))
- added dateBlocksDayInfoFactory() ([ee8cf129](https://github.com/dereekb/dbx-components/commit/ee8cf129b6291f679f31ea3db306ceca4a44fd13))
- added dateBlocksInDateBlockRange() ([979adb22](https://github.com/dereekb/dbx-components/commit/979adb22820168f019a9646b29455c37008f4941))
- added DateBlockTiming class ([15e583bc](https://github.com/dereekb/dbx-components/commit/15e583bc1cc5fbfb43ad09fe5c85d80de3dbc659))
- added dateRangeOverlapsDateRange() ([179bd15d](https://github.com/dereekb/dbx-components/commit/179bd15df083d0a56d2996dcb05ff3067aaa61f6))
- added DayOfWeek ([0c82ffbd](https://github.com/dereekb/dbx-components/commit/0c82ffbdbce1f5b018304c03a2c3c73c1b41d381))
- added dbx-chip, dbxColor ([cff2b2d4](https://github.com/dereekb/dbx-components/commit/cff2b2d4946ee6f344d4509181176c7b1e69c537))
- added dbx-mapbox-markers ([d643edfc](https://github.com/dereekb/dbx-components/commit/d643edfcf1d2d156f205393124cd6f65698804bb))
- added dbx-scroll-content ([d49d6621](https://github.com/dereekb/dbx-components/commit/d49d6621dc8ccbf925fd443e8fb625a0d867a711))
- added dbxActionPreSuccess, dbxActionDisabledOnSuccess directives ([10929ab3](https://github.com/dereekb/dbx-components/commit/10929ab376fb016ec5e7b2c90b0fcbf886ff0d15))
- added DbxAuthNotAnyRolesDirective ([3109123a](https://github.com/dereekb/dbx-components/commit/3109123a1897e25dfe399cf10a111799ce61a061))
- added DbxFirebaseAnalyticsUserSource ([9b0eb28d](https://github.com/dereekb/dbx-components/commit/9b0eb28d77c7f7478fb949fdc1299bad97c643e2))
- added DbxFirebaseInContextFirebaseModelServiceInstance ([a8396399](https://github.com/dereekb/dbx-components/commit/a83963997b83ecc7ef642c5ddb507060d0dbead8))
- added DbxFormSearchFormComponent ([befd5c88](https://github.com/dereekb/dbx-components/commit/befd5c8878af63156ae1a791b3a28c34da99e8d5))
- added DbxMapboxMarkerComponent ([368a816f](https://github.com/dereekb/dbx-components/commit/368a816fff35767c0440ae66752ee204eb58460a))
- added DbxMapboxOptions ([f5f1b1b7](https://github.com/dereekb/dbx-components/commit/f5f1b1b73791ea039e006aa73042d46c159335d6))
- added DbxValueListGridSizeDirective ([216e1209](https://github.com/dereekb/dbx-components/commit/216e1209a8a7496f5480c3112fce06f435bce19f))
- added DbxWidgetListGridComponent ([aa33b3fb](https://github.com/dereekb/dbx-components/commit/aa33b3fb0e9250f435efdf21b07fe212286a0255))
- added decisionFunction() ([121d0e0a](https://github.com/dereekb/dbx-components/commit/121d0e0a3147a667c1906c0295d6377f05dee7f3))
- added development components to setup templates ([11c928a6](https://github.com/dereekb/dbx-components/commit/11c928a6069f93a0cc2a19b7a8b04af1b83f6970))
- added distrinctUntilKeysChange() ([e917c11d](https://github.com/dereekb/dbx-components/commit/e917c11d4575b20afd1bcd46ce925ce5729728df))
- added documentRef() to FirestoreSingleDocumentAccessor ([ba0ead7c](https://github.com/dereekb/dbx-components/commit/ba0ead7ca250d78c4db67a0a1175e8e17e5616c1))
- added dollarAmountField() ([b0c23a0b](https://github.com/dereekb/dbx-components/commit/b0c23a0bfb1ca610a633a60613f7a67bbc00c3ad))
- added DollarAmountString ([ce76cc81](https://github.com/dereekb/dbx-components/commit/ce76cc815a80c17069acb4f6be3b3b3035e8d7e1))
- added FirebaseAuthOwnershipKey ([338ef284](https://github.com/dereekb/dbx-components/commit/338ef284401ff642d44b073d84a829f8d3c0580e))
- added firebaseDocumentStoreCrudFunction() ([dc586ca6](https://github.com/dereekb/dbx-components/commit/dc586ca6a7f8f01fd4efdbcdb0b3555550e09777))
- added FirebaseFunctionReadAction ([0add8935](https://github.com/dereekb/dbx-components/commit/0add893563a6d0c1c901cda111c78b40590955e2))
- added FirebaseServerAuthServiceRef ([593a705c](https://github.com/dereekb/dbx-components/commit/593a705c2a12e8a9659b109a834b80e1e10fce4d))
- added FirebaseServerEnvService ([7c4b7744](https://github.com/dereekb/dbx-components/commit/7c4b7744fe4f4101cd2da1f06ba2e538cdaa3561))
- added firestoreDateBlockRange() ([67f2dbad](https://github.com/dereekb/dbx-components/commit/67f2dbad108073df6f9632fbb968b61fa4a8d731))
- added firestoreDencoderStringArray() ([205548a8](https://github.com/dereekb/dbx-components/commit/205548a87a51453435246448b82ae1d7d1a835cb))
- added firestoreDummyKey() ([1c751e63](https://github.com/dereekb/dbx-components/commit/1c751e63a7a33d2051c2916203e9e16f836fb06b))
- added firestoreMapZoomLevel ([1ed17ea7](https://github.com/dereekb/dbx-components/commit/1ed17ea7498834d6248810947740311971d668a6))
- added FirestoreModelCollectionTypeArrayName ([7d60535a](https://github.com/dereekb/dbx-components/commit/7d60535a0102147646396f3fac844538bcca0fd7))
- added firestoreModelId() ([8173e650](https://github.com/dereekb/dbx-components/commit/8173e6507003fbd90b620e6bdff37a1aae914d96))
- added firestoreModelKeyEncodedGrantedRoleMap() ([627b8e23](https://github.com/dereekb/dbx-components/commit/627b8e23ec74523275bd2f155ad5aedcb604c82e))
- added firestoreModelKeyPairObject() ([c3c30c5a](https://github.com/dereekb/dbx-components/commit/c3c30c5adc6d74682699d21b884ed13ebb9a3c13))
- added firestoreModelType() ([079c6eb4](https://github.com/dereekb/dbx-components/commit/079c6eb4dd77119c98c0c33ca6adc0ea88556858))
- added firestoreTimezoneString() ([17621327](https://github.com/dereekb/dbx-components/commit/17621327049ea5eda7d3ed43036a7a0300a5f6a1))
- added firstAndLastValue() ([d5db6802](https://github.com/dereekb/dbx-components/commit/d5db6802784dbb3934f61cf022a9d7b37c9c6ccd))
- added FlatFirestoreModelKey ([bb981e95](https://github.com/dereekb/dbx-components/commit/bb981e95a721e656607b152ab807b4024ba44f0a))
- added formatToISO8601DayString() ([95509972](https://github.com/dereekb/dbx-components/commit/95509972e3491f59e8453bdcc2c86a66abb2502f))
- added GrantedAdminRole ([e1d49872](https://github.com/dereekb/dbx-components/commit/e1d49872bff34f07b0cb638ef53c8bdaad1a5e2c))
- added GrantedOwnerRole ([989c9d58](https://github.com/dereekb/dbx-components/commit/989c9d58936ba9770240ad5eb02acfcf2f5d746e))
- added grantedRoleKeysMapFromArray() ([c8637ec8](https://github.com/dereekb/dbx-components/commit/c8637ec808b00bf42df2dc690181d6484bdbcea3))
- added grantModelRolesIfHasAuthRolesFactory() ([eeeda5ca](https://github.com/dereekb/dbx-components/commit/eeeda5caf01ee9aaab7ccc6314c1c6e731632ec1))
- added groupToDateBlockRanges() ([8e1edf33](https://github.com/dereekb/dbx-components/commit/8e1edf33e3cf5e72a0daf8bbc61dd4c299a1357c))
- added handleFirebaseAuthError ([9cf39f6d](https://github.com/dereekb/dbx-components/commit/9cf39f6dea66d5e799e9e79728bb86054fc4fab3))
- added hasDocuments$ to DbxFirebaseCollectionStore ([fdefa783](https://github.com/dereekb/dbx-components/commit/fdefa78383971287cd4ef24221213a20a4a2b7a8))
- added hasNewUserSetupPasswordInRequest() ([87b04ed1](https://github.com/dereekb/dbx-components/commit/87b04ed16911f29610f0df66c7930c15ee6f7753))
- added hasValueFunction() ([a2c07018](https://github.com/dereekb/dbx-components/commit/a2c070183255c79e52767a12f6a8c9ee907385b7))
- added indexDeltaGroupFunction() ([b297f074](https://github.com/dereekb/dbx-components/commit/b297f074bc54fa7e7951feb3560f64ebaa96187a))
- added indexedValuesArrayAccessorFactory() ([e6ace4cd](https://github.com/dereekb/dbx-components/commit/e6ace4cd3166cb5e3473fb8e1996592469d38f7a))
- added isDateRangeInDateRange() ([65dcf69e](https://github.com/dereekb/dbx-components/commit/65dcf69e5b490e0541c0b191811aa1480eba5e70))
- added IsISO8601DayString validator ([05b1a6e5](https://github.com/dereekb/dbx-components/commit/05b1a6e5f0dc7488b53c959615e348d4185d063c))
- added isLatestSuccessfulRoute() ([f419f831](https://github.com/dereekb/dbx-components/commit/f419f831915b8ab6da5fb53c757de68d923fdb3c))
- added isolateSlashPathFunction() ([5684962b](https://github.com/dereekb/dbx-components/commit/5684962bcadea5655ab32e754a0105b756bd6dfe))
- added isolateWebsitePathFunction() ([6e76acb4](https://github.com/dereekb/dbx-components/commit/6e76acb4eef71642c4ed8efdf65edba6117c1d58))
- added isSlashPathTypedFile() ([d33959a4](https://github.com/dereekb/dbx-components/commit/d33959a42c05dafc298581054593d565e5bd0c0b))
- added isTestNodeEnv() ([a4df1e9a](https://github.com/dereekb/dbx-components/commit/a4df1e9a13089ae8d05f4c02b4663f29cf702b76))
- added keyValueMap(), multiKeyValueMap() ([555cad60](https://github.com/dereekb/dbx-components/commit/555cad6067b03c5f3dba14ee04b427708e66bbbd))
- added latLngTextField() ([adee956c](https://github.com/dereekb/dbx-components/commit/adee956cd70ed651c82091fac22b701e17d846dc))
- added MailgunServiceRef ([451a2e1a](https://github.com/dereekb/dbx-components/commit/451a2e1a8f80a40f7a202c54650d51db24589b2f))
- added MaybeIndexRef ([6e2e7919](https://github.com/dereekb/dbx-components/commit/6e2e7919ad229262c39b24a0daa8ad1034c7071a))
- added mergeFilterFunctions() ([6c62f569](https://github.com/dereekb/dbx-components/commit/6c62f5697b983333d02b2a08bc1941cbf344d3e4))
- added modifyDateBlocksToFitRangeFunction() ([f43cfa9d](https://github.com/dereekb/dbx-components/commit/f43cfa9d1049f4442063a55ef9d00885ba37819d))
- added monthDaySlashDateToDateString() ([472f99fc](https://github.com/dereekb/dbx-components/commit/472f99fca6c086db2901a8bdd299bf8daaf8fcf0))
- added NeedsSyncBoolean ([6e8106bc](https://github.com/dereekb/dbx-components/commit/6e8106bca59a93e161c00b44593e68680df3e934))
- added notFoundError() ([0f210b02](https://github.com/dereekb/dbx-components/commit/0f210b02120f9e98c406ddff49712a2ecb422486))
- added onCallTypedModelParams() ([31211c0c](https://github.com/dereekb/dbx-components/commit/31211c0c839551c98508e1c8dc6d717e3e240b94))
- added optionalFirestoreUnitedStatesAddress() ([3a972090](https://github.com/dereekb/dbx-components/commit/3a97209061d39aa4fa27d19ee1df159b37eb5f33))
- added primativeKeyStringDencoder() ([94bbf132](https://github.com/dereekb/dbx-components/commit/94bbf1322a09601657c030a01f974cc2f0a7473a))
- added randomEmailFactory() ([f86b8c44](https://github.com/dereekb/dbx-components/commit/f86b8c44b29263baaf3c302adefdb42ec8a65494))
- added randomPhoneNumberFactory() ([c4354c53](https://github.com/dereekb/dbx-components/commit/c4354c536414088f66757fe2679bde152f05438f))
- added readKeysToMap() ([23076f9f](https://github.com/dereekb/dbx-components/commit/23076f9fb9b3efa5cf03563c9808f2b2856f7809))
- added reauthenticateWithPopup() ([f3f15fed](https://github.com/dereekb/dbx-components/commit/f3f15fed8a25fbc97ae0a83b171fb56a01a5ed47))
- added refreshToken() ([f155902d](https://github.com/dereekb/dbx-components/commit/f155902d1fcb2ac77f41b890de5ddee9786797a4))
- added setRoles() ([531fc4c4](https://github.com/dereekb/dbx-components/commit/531fc4c4982b1471c53f0cc7e99395946e42c090))
- added splitJoinNameString() ([edd3a8e5](https://github.com/dereekb/dbx-components/commit/edd3a8e56d7c0dc027df7d79dc8cbb38f8717860))
- added splitJoinReminder() ([0212e639](https://github.com/dereekb/dbx-components/commit/0212e6391651079d6453a88c0be759b6998ac3be))
- added storageService to ServerActionsContext template ([8defdbf1](https://github.com/dereekb/dbx-components/commit/8defdbf1ceaa1a6c81b62345fb10a26a8738393e))
- added SystemState action types ([2fc7a793](https://github.com/dereekb/dbx-components/commit/2fc7a793c513dfcafaa4ddb2b491add95648fbbe))
- added tapOnLoadingStateSuccess() ([ec23a1cb](https://github.com/dereekb/dbx-components/commit/ec23a1cbf69e70ab12630f51fb6014ba3ac0a592))
- added TargetIdParams ([ecec736b](https://github.com/dereekb/dbx-components/commit/ecec736b694494a1a8614a2e834508b259448f3f))
- added top padding to dbx-error ([c4ab5808](https://github.com/dereekb/dbx-components/commit/c4ab58085a5228e86fd14fe259ae27e2467a05a6))
- added triggerWithValue() ([5ee68c36](https://github.com/dereekb/dbx-components/commit/5ee68c36239c61450898bdaa9eb7caecfd66c601))
- added truthMap() to GrantedRoleMapReader ([885e727f](https://github.com/dereekb/dbx-components/commit/885e727fe8cdfcf6cf7d68419e590d064ed9c5ba))
- added types ([fc1aa970](https://github.com/dereekb/dbx-components/commit/fc1aa9709fcd684ae34783fbb36eda025108c8ec))
- added types to firestoreUniqueStringArray() ([0ce9faa5](https://github.com/dereekb/dbx-components/commit/0ce9faa5903aa978aaefc4679ed5ba0212a52793))
- added uid$ to DbxFirebaseAuthService ([c783d10a](https://github.com/dereekb/dbx-components/commit/c783d10afc4eef4ea4c49520dd64c5b74cda1bda))
- added utility functions ([809051e5](https://github.com/dereekb/dbx-components/commit/809051e5382121617323dbd1fe38fc1ed4fc88b6))
- added WebsiteLink class for class-validator ([bbc3af3a](https://github.com/dereekb/dbx-components/commit/bbc3af3a6fd11105f09766cd4210f28940dbdd7a))
- added whereStringHasRootIdentityModelKey() ([773c1077](https://github.com/dereekb/dbx-components/commit/773c107777a13dafbfd4527e46f41fbe34eaac2f))
- added whereStringValueHasPrefix() ([e751f8c7](https://github.com/dereekb/dbx-components/commit/e751f8c787b63829ddd160ff1406c0d0d0adb705))
- added YearWeekCode ([32638e33](https://github.com/dereekb/dbx-components/commit/32638e330d3f79b1b7400e6c19d9ef5292089fa3))
- create .env.secret on postinstall ([eb1cdba0](https://github.com/dereekb/dbx-components/commit/eb1cdba0cc7fd1c94fe5142c3e97d070545633e5))
- dateBlockRangeBlocksCountInfo() ([504d8c8f](https://github.com/dereekb/dbx-components/commit/504d8c8f08617b61ae4c3eeb006771cd90db89ea))
- fixed .dbx-chip.mat-standard-chip style export ([f32e0d75](https://github.com/dereekb/dbx-components/commit/f32e0d75a28dcd548a5b2bc3fbbce08ee2434f67))
- fixed dateBlockIndexRangeToDateBlockRange() return type ([b5a16eca](https://github.com/dereekb/dbx-components/commit/b5a16eca2a04ff792ebbfb4dd4bd1e404c5b57b6))
- fixed styling for dbx-list-view-item dbx-injected content ([ffcf03f0](https://github.com/dereekb/dbx-components/commit/ffcf03f00e962876cf26f1e9b7a67f9926b18353))
- lint fix ([9bd7b568](https://github.com/dereekb/dbx-components/commit/9bd7b5687a79378aea81dc14ce9c7bd13df46f66))
- modelTestContextFactory() now passed the type of collection ([5a16d951](https://github.com/dereekb/dbx-components/commit/5a16d951fefe6b900ff0921c5f54559436c9f3fe))
- print package.json in ci script test ([3562b58f](https://github.com/dereekb/dbx-components/commit/3562b58f7e01b6845bc8a5312658bf2526216867))
- updated addressFormlyField required config ([e425a3e7](https://github.com/dereekb/dbx-components/commit/e425a3e7dd9438df3b3525280c49bcf687a3824e))


### Releases

- **$workspace:** v13.11.4 release ([7f8c32df](https://github.com/dereekb/dbx-components/commit/7f8c32df575f25511ba8c6bca7de2a63e489aa3c))


### Tests

- added AbstractFirebaseServerNewUserService tests ([0bf9403a](https://github.com/dereekb/dbx-components/commit/0bf9403ae9ec0d87e5c949a576be273dfdfcf369))
- added additional firebase admin auth tests ([35b9224f](https://github.com/dereekb/dbx-components/commit/35b9224f22c8cb77732cc1034f08c33c8dc818c0))
- added additional firebase tests ([33e9a1a7](https://github.com/dereekb/dbx-components/commit/33e9a1a7004b9d3feb909507aa15816cbdcdbca2))
- added dateCellIndexRange tests ([7a3d088d](https://github.com/dereekb/dbx-components/commit/7a3d088de800792771f71526201220b4195beffe))
- added DateSchedule exclusion tests ([a1f0bb9f](https://github.com/dereekb/dbx-components/commit/a1f0bb9f25b66d38930ac961be45c47fc05a6bd9))
- added example spec to setup-project ([414ace5e](https://github.com/dereekb/dbx-components/commit/414ace5e05d632f83ef9c0076feb61f912e9df90))
- added fetch url spec test ([cb503ad3](https://github.com/dereekb/dbx-components/commit/cb503ad330412f0342804dbf8cc6574db25abe74))
- added firestore iterator tests, query tests ([34462d17](https://github.com/dereekb/dbx-components/commit/34462d17804c4aa0d7846558c681166d7fb86eea))
- added makeRulesTestFirebaseStorageContext default bucket ([5bae7597](https://github.com/dereekb/dbx-components/commit/5bae759752405cce5ff25bf3638c64e7e0b4394b))
- added query driver tests ([ac22b01e](https://github.com/dereekb/dbx-components/commit/ac22b01e88df13aeb2f1514dda6ff860dba704b8))
- added setup project testing ([f4e1c953](https://github.com/dereekb/dbx-components/commit/f4e1c9538ac030f36c68f067400bf3b458d50824))
- added test for isDefaultLatLngPoint() ([3feb7125](https://github.com/dereekb/dbx-components/commit/3feb712588896431b8e52687a0bb8bcf55155c11))
- added tests for exampleUsageOfSchedule, exampleDevelopmentFunction ([6c5ce2d1](https://github.com/dereekb/dbx-components/commit/6c5ce2d111c534d45b21c6ee153e46813ceb2f03))
- added tests for Kiritimati and Niue timezones ([51a822db](https://github.com/dereekb/dbx-components/commit/51a822dbd06d6b44934e9d94bd0244d62a6a0d1b))
- added upload() test ([6ae1f042](https://github.com/dereekb/dbx-components/commit/6ae1f0424d6c2da7aa187a2cf42bbeac9bf3aff0))
- added yearWeekCode tests ([41423f34](https://github.com/dereekb/dbx-components/commit/41423f342137e5a76e64556d1e8302c2363378ef))
- date tests fix ([de888a11](https://github.com/dereekb/dbx-components/commit/de888a1123f31d5dd6f3bd26fdf88fc0c9d821c8))
- date tests fix ([009e239b](https://github.com/dereekb/dbx-components/commit/009e239bbd96839127cc86e034a49a56398ac3ee))
- **dbx-form:** cover state field idempotentTransform wiring ([9336a456](https://github.com/dereekb/dbx-components/commit/9336a456fbbd2acdfc8f0fb9d6d63c1a26d39781))
- fixed dateScheduleDateFilter() test ([7c6be737](https://github.com/dereekb/dbx-components/commit/7c6be7372948f28b3462a010f7c59c7d714abeef))
- improved firestore driver test description ([0fc1f161](https://github.com/dereekb/dbx-components/commit/0fc1f161a05dd3f2d84776eee4216a235c0a6547))
- improved increment() tests ([4280c42e](https://github.com/dereekb/dbx-components/commit/4280c42e5bdd9a5885c079846b318e78257042c7))
- increased jest timeout for fetch requests ([755792bb](https://github.com/dereekb/dbx-components/commit/755792bb1999e74dff55c4d9acd2be8098a29f77))
- profileSetUsername tests ([dff3cd7b](https://github.com/dereekb/dbx-components/commit/dff3cd7b8d7c268e3ebebbadd15c06925a82509b))
- storage test fix ([ef4ed56d](https://github.com/dereekb/dbx-components/commit/ef4ed56de6f6d67ac6c5adfb7ff58998aaafb272))
- subcollection accessor tests ([2f0aa048](https://github.com/dereekb/dbx-components/commit/2f0aa0485862d91ff94c62fcddab729ac02fa9a0))
- test fix ([86b1dfcc](https://github.com/dereekb/dbx-components/commit/86b1dfcc1be70c17d58c8b25617401f02efa378a))
- test fix ([71e4c60d](https://github.com/dereekb/dbx-components/commit/71e4c60d3790be8bdd6cbb0a14667f0bf12230f3))
- test fixes ([34f310ad](https://github.com/dereekb/dbx-components/commit/34f310ad64c1d5efbbfd9943a9d5c85240ee069b))


### BREAKING CHANGES

* Angular 18 and Nx 20 major version
* all breaking changes are documented in VERSION_MIGRATION.md
* remove constructor from AbstractSubscriptionDirective
* prepare major version
* - removed converter from DocumentReference
- additionally, the following previous breaking changes were not properly tagged:
- converter is now required for firestoreContext collection config
- modelIdentity is now required in FirestoreContext firestore collection functions
- removed other deprecated functions
* updated all onCall and functions to now use a single request object instead of multiple parameters
* model type is now required on FirestoreDocument models
* refactored @dereekb/firebase SnapshotConverterFunction and related components and @dereekb/util model conversion components to have better type safety and inference
* - renamed flattenIterationResultItemArray to flattenAccumulatorResultItemArray since the input is an accumulator and not an iteration
* renamed value to itemValue to better avoid issues when using DbxValueAsListItem values

- Added DbxValueAsListItem type for those use cases
* renamed dbxInjectedContent to dbxInjection, renamed related content
* renamed ConversionFunction (and related types) to MapFunction
* Renamed DbxActionState SUCCESS state to RESOLVED
* **dbx-analytics:** Added dbx prefix to all analytics items to keep consistency

## [13.11.4](https://github.com/dereekb/dbx-components/compare/v13.11.3-dev...v13.11.4) (2026-05-09)


### Bug Fixes

- gate oidc consent submit on auth state ([bf48547b](https://github.com/dereekb/dbx-components/commit/bf48547b675b549eca851e62f163b6b73fbf65a7))


### Build System

- lint fix + mcp regeneration ([b731ffee](https://github.com/dereekb/dbx-components/commit/b731ffee570e5571fb130114bfc1845490367651))


### Code Refactoring

- @__NO_SIDE_EFFECTS__ on overloaded factory impls ([9ae015f2](https://github.com/dereekb/dbx-components/commit/9ae015f2e000d461df87dec609405ef35560d191))
- added dbx-firebase-oidc-grant-list-container ([0723879c](https://github.com/dereekb/dbx-components/commit/0723879cb6d0367b40242586b832e90d161f19ef))
- added oidc ttl options ([b676bff2](https://github.com/dereekb/dbx-components/commit/b676bff23abc7f07d28fe8799506e525c06f3587))
- added trustProxy config to odic module ([e51ed2ad](https://github.com/dereekb/dbx-components/commit/e51ed2adba9ca83c79a91d6ecebeda4d479ea66d))
- dbx-components-mcp improvements ([b75a0f6c](https://github.com/dereekb/dbx-components/commit/b75a0f6c3b85151936be535657291f48f6e48962))
- test fixes ([4beda305](https://github.com/dereekb/dbx-components/commit/4beda3051aa88289a29361b284eef07248285d88))

## [13.11.3](https://github.com/dereekb/dbx-components/compare/v13.11.2-dev...v13.11.3) (2026-05-08)


### Build System

- lint fix + mcp regeneration ([c676b46e](https://github.com/dereekb/dbx-components/commit/c676b46e3517470f68cdb11cf35d90dbce865b54))


### Code Refactoring

- added @__NO_SIDE_EFFECTS__ to factories ([857ee869](https://github.com/dereekb/dbx-components/commit/857ee869782d59402b6998ce9cab5ff4a9f86448))
- added NotificationLoggedEvent ([5b404553](https://github.com/dereekb/dbx-components/commit/5b4045536ab14cb33387c586f3b91d6debcc3ab4))
- added paged-item firestore subcollection ([4f78829e](https://github.com/dereekb/dbx-components/commit/4f78829ef5605607661e906ad968197b6761bf6a))
- model-snapshot-fields mcp tools ([a66d93ad](https://github.com/dereekb/dbx-components/commit/a66d93ad9cefccc82e7ac1a01374f79cdfffcf2c))
- sonarqube refactoring ([537a68fb](https://github.com/dereekb/dbx-components/commit/537a68fb1173c8176fb06077ceafa4f9302ce5a1))
- updated notification logged event tests ([eaa088cd](https://github.com/dereekb/dbx-components/commit/eaa088cd4f40e5c00a026fb99422627e9b326f58))
- zoho setup script + dbx.setup.json manifest ([5cfa6862](https://github.com/dereekb/dbx-components/commit/5cfa6862d5848519f0c2d421c56965fefa43be2d))

## [13.11.2](https://github.com/dereekb/dbx-components/compare/v13.11.1-dev...v13.11.2) (2026-05-07)


### Bug Fixes

- **dbx-form:** forge stripEmptyValues now recurses into arrays ([1e771eee](https://github.com/dereekb/dbx-components/commit/1e771eee6d52cd853d7555c5147e35e82b51234f))


### Build System

- lint fix + mcp regeneration ([0ad6eec1](https://github.com/dereekb/dbx-components/commit/0ad6eec14dd945a718da976f70ea841e875dde29))


### Code Refactoring

- dedupe api.ts crud extractor ([fa1d5aa0](https://github.com/dereekb/dbx-components/commit/fa1d5aa06c488c1b9b8b963e71c11cfba792aa7d))
- form fixes ([977e012b](https://github.com/dereekb/dbx-components/commit/977e012b471fa24b1fdcb0ea04331f71a61d174e))
- moved callModel OIDC scopes to @dereekb/firebase ([11f50fa9](https://github.com/dereekb/dbx-components/commit/11f50fa9d12c21cb7b8d99da458e49da766281ea))
- updated model cli manifest documentation ([518b6fdb](https://github.com/dereekb/dbx-components/commit/518b6fdbbd75310f2ed5575f2c4d7f6ca6314cc6))

## [13.11.1](https://github.com/dereekb/dbx-components/compare/v13.11.0-dev...v13.11.1) (2026-05-07)


### Build System

- lint fix + mcp regeneration ([128e22e0](https://github.com/dereekb/dbx-components/commit/128e22e0d3d617f03a4ecd5f22fd0583fd17b1d4))


### Code Refactoring

- dbx-cli manifest commands under model parent ([df534037](https://github.com/dereekb/dbx-components/commit/df5340372ebb69e1b105496e36614cef13b6b2b0))
- fixed extract manifest warnings ([b1ee475c](https://github.com/dereekb/dbx-components/commit/b1ee475ceb93ee9be1311a9eadee9e89d091a348))
- node_modules fallback for firebase-api-manifest ([aafeeec1](https://github.com/dereekb/dbx-components/commit/aafeeec1da82b96e9f29402f11f4d9a470338f43))
- ship firebase-api-manifest in @dereekb/dbx-cli ([61c0cdce](https://github.com/dereekb/dbx-components/commit/61c0cdce5674fbccc973f6a6763c6acd9f0dbd4a))
- updated dbx-cli deploying ([21d5dc2d](https://github.com/dereekb/dbx-components/commit/21d5dc2d922ba02a6bf55c6b0f3f2d2878894cc6))

# [13.11.0](https://github.com/dereekb/dbx-components/compare/v13.10.9-dev...v13.11.0) (2026-05-07)


### Build System

- lint fix + mcp regeneration ([c49d3a28](https://github.com/dereekb/dbx-components/commit/c49d3a2808a2552d1e99e704959fcaa790a464d7))


### Code Refactoring

- update ng-forge version ([bb00372b](https://github.com/dereekb/dbx-components/commit/bb00372be990df3ef8dce1ba464acd2798ef0685))


### Features

- dbx-cli ([#48](https://github.com/dereekb/dbx-components/issues/48)) ([96a2d505](https://github.com/dereekb/dbx-components/commit/96a2d5057450fadf9562fd251e9496fe6d94234c)), closes [#48](https://github.com/dereekb/dbx-components/issues/48)

## [13.10.9](https://github.com/dereekb/dbx-components/compare/v13.10.8-dev...v13.10.9) (2026-05-05)


### Bug Fixes

- **dbx-form:** datetime preset reverts under tz shift ([9b8dfecc](https://github.com/dereekb/dbx-components/commit/9b8dfecc48070b15a7a99a6899a846801c70f0fe))


### Code Refactoring

- added dbx-asset mcp tools ([dd0e199d](https://github.com/dereekb/dbx-components/commit/dd0e199dc924eb0c506134d85558726f0b5163ab))
- added detectPdfEncryption to @dereekb/nestjs ([7e2a5e98](https://github.com/dereekb/dbx-components/commit/7e2a5e98284752ba90cddb0242f2e8296ac9641e))
- enriched firebase-lookup model output ([efccc35f](https://github.com/dereekb/dbx-components/commit/efccc35fd7ffb5fead6184dd257120aa69881a5b))
- resolve sonarqube issues ([c10ae11f](https://github.com/dereekb/dbx-components/commit/c10ae11fd71b6f5407762bc971e5d503ce562052))
- sonarqube fixes ([08bf595b](https://github.com/dereekb/dbx-components/commit/08bf595b4f938d3657f37d11776f7ff15eebdf0e)), closes [Array#push](https://github.com/dereekb/Array/issues/push)

## [13.10.8](https://github.com/dereekb/dbx-components/compare/v13.10.7-dev...v13.10.8) (2026-05-05)


### Build System

- **dbx-components-mcp:** lint fix ([19f0b1cd](https://github.com/dereekb/dbx-components/commit/19f0b1cd2144a3c35613ecc71423397e72bc3b6a))
- lint fix ([65c35953](https://github.com/dereekb/dbx-components/commit/65c3595368d8ea77dadea8048ef3127c1ca4cda9))
- lint fix + mcp regeneration ([acb112fa](https://github.com/dereekb/dbx-components/commit/acb112fa7902aa3e7c0b94638519e3a5745da8c1))
- peer dep sync + mcp regeneration ([e5ded0f7](https://github.com/dereekb/dbx-components/commit/e5ded0f7ab86565f6975a2f7faaf7096c581c73b))


### Code Refactoring

- added dbx-icon-tile component and directive ([0fe5845d](https://github.com/dereekb/dbx-components/commit/0fe5845db2cf434a9bd6abe8373467330e121f82))
- added M3 type-role text utilities ([7c528985](https://github.com/dereekb/dbx-components/commit/7c528985cbd6d99eb80d771a24204cf285dd87ab))
- annotated reusable css utilities pass 2 ([4fb83581](https://github.com/dereekb/dbx-components/commit/4fb83581deea29474d4c974d0dbdad1c331ed0d4))
- bump ng-forge version ([da7e4e70](https://github.com/dereekb/dbx-components/commit/da7e4e7060f960ab37ce45b1f360875fd09376b9))
- bump nx version, angular version ([913815fa](https://github.com/dereekb/dbx-components/commit/913815faaeb054396f1e019829b7604c8bedd7d9))
- dbx-components-mcp css-utility cluster ([cc32399e](https://github.com/dereekb/dbx-components/commit/cc32399e6a99a7b052b507507c558bf26da9396a))
- **dbx-components-mcp:** added dbxDocsUiExamples cluster ([1aff5b89](https://github.com/dereekb/dbx-components/commit/1aff5b892096171e4cd07c31fe04fc3d3790e7fe))
- **dbx-components-mcp:** drop sourcePath/sourceLocation ([d2d2d501](https://github.com/dereekb/dbx-components/commit/d2d2d501984f1ba5ba41ad5aa9fab2e003d9ebd0))
- **dbx-components-mcp:** improve ui-smell-check output ([b21f1dcb](https://github.com/dereekb/dbx-components/commit/b21f1dcbecb6da30c705700de682f45c23926b91))
- **dbx-components-mcp:** sonar issue cleanup ([cc865449](https://github.com/dereekb/dbx-components/commit/cc86544987184145fc5a8004006140b00f1a066d)), closes [Array#push](https://github.com/dereekb/Array/issues/push)
- dbx-pdf-merge-editor slot uploaders + validator ([45287d42](https://github.com/dereekb/dbx-components/commit/45287d42830a0ace6437c270b74cb690c866f063))
- list-card-items-list paints mat-mdc-list-item directly ([7e7576fb](https://github.com/dereekb/dbx-components/commit/7e7576fb7fa9ed27180c9f509484b90db16e0420))
- marked packages sideEffects-free ([11651c19](https://github.com/dereekb/dbx-components/commit/11651c1990bd81fea06ba39d39086f43104899f2))
- replaced .dbx-bold with M3 type-role utilities ([05437e02](https://github.com/dereekb/dbx-components/commit/05437e02a4da352ce0c243c56f188b26c5811b88))
- update ng-forge version ([80516aba](https://github.com/dereekb/dbx-components/commit/80516abac47c971adc5904622984bec18ee7dca5))
- updated _pdf.scss ([5b852401](https://github.com/dereekb/dbx-components/commit/5b852401d0d0e48d7186518c20960f6cc07576f0))


### Demo

- added card example page ([7c0a4c16](https://github.com/dereekb/dbx-components/commit/7c0a4c164c9e338f3f383f5ee1510f67ddbe9395))

## [13.10.7](https://github.com/dereekb/dbx-components/compare/v13.10.6-dev...v13.10.7) (2026-05-04)


### Build System

- lint fix + mcp regeneration ([e413ee86](https://github.com/dereekb/dbx-components/commit/e413ee866c4ff79195e306502c3c4ce66bc18c4a))


### Code Refactoring

- added @dereekb/dbx-web/eslint plugin ([3db6d2a8](https://github.com/dereekb/dbx-components/commit/3db6d2a831d4c27de66357379c1a93cd71b96547))
- added DbxWebPageTitleInfoDirective ([3a90265c](https://github.com/dereekb/dbx-components/commit/3a90265c23632abbcdfa606880c28f6bb6d60edb))
- **dbx-components-mcp:** added css-token-lookup, ui-smell-check ([719f3c76](https://github.com/dereekb/dbx-components/commit/719f3c76f00a23ede9b26e78d50f6f54ceb53fff))
- **dbx-components-mcp:** tune ui-smell-check from demo ([fbc14858](https://github.com/dereekb/dbx-components/commit/fbc148581db01be68639851a5af49ed6042f0742))
- lint-fix ([dd7d218b](https://github.com/dereekb/dbx-components/commit/dd7d218b66fb926a56a67d25f42dcf3407bf9f77))
- recognize non-model fixtures in fixture validator ([2f130dad](https://github.com/dereekb/dbx-components/commit/2f130dadbd1e81d9d455dee807bdedc2efd5f548))
- shorter init out filenames in dbx-components-mcp ([5018bce0](https://github.com/dereekb/dbx-components/commit/5018bce036fd4fbf716c4cc82d76fabe96ec8811))

## [13.10.6](https://github.com/dereekb/dbx-components/compare/v13.10.5-dev...v13.10.6) (2026-05-02)


### Bug Fixes

- fixed calendar selection regression ([7e6a1373](https://github.com/dereekb/dbx-components/commit/7e6a137329aa597b09c6ea7e49e587fd6b42570d))

## [13.10.5](https://github.com/dereekb/dbx-components/compare/v13.10.4-dev...v13.10.5) (2026-05-01)


### Code Refactoring

- **dbx-components-mcp:** added dbx_model_api_* tool cluster ([68a7b368](https://github.com/dereekb/dbx-components/commit/68a7b368d1a1035d63a55882e54bd618495c73ee))
- **dbx-components-mcp:** added fields filter to model lookup ([2b1cbd97](https://github.com/dereekb/dbx-components/commit/2b1cbd974737495ed116a4102046d1d8df02029a))
- **dbx-components-mcp:** clarified @dbxModelVariable guidance ([58be05f0](https://github.com/dereekb/dbx-components/commit/58be05f0e318b16261f0a4bdf17b620f3bf632e5))
- **dbx-components-mcp:** recognize itShould* as it ([76d9919f](https://github.com/dereekb/dbx-components/commit/76d9919f01e3d0788a6c6297f52b3abb8e954952))
- **dbx-components-mcp:** resolved sonarqube findings ([b833e7ed](https://github.com/dereekb/dbx-components/commit/b833e7ed333799936f7594aaaa9a02f4f9ed8782)), closes [String#match](https://github.com/dereekb/String/issues/match)
- **dbx-web:** added pdf merge editor extension ([27370932](https://github.com/dereekb/dbx-components/commit/2737093271710c00333d1834a0bba2ba335b2992))
- fixed lock file ([61d38a21](https://github.com/dereekb/dbx-components/commit/61d38a211a9bfdb20f316a583c4dc4c1a5a42f32))
- refactored pdf merge editor extension ([16031394](https://github.com/dereekb/dbx-components/commit/1603139485243767633051dd2eec941e7d868d10))

## [13.10.4](https://github.com/dereekb/dbx-components/compare/v13.10.3-dev...v13.10.4) (2026-04-30)


### Build System

- lint fix + mcp regeneration ([cd3bf0fb](https://github.com/dereekb/dbx-components/commit/cd3bf0fbbe9df7dc7ec014126daff7ad2103d3e6))


### Code Refactoring

- **dbx-components-mcp:** added model test tree/search tools ([9787c159](https://github.com/dereekb/dbx-components/commit/9787c1591f6b72709331d8750a6d6e2e6c24a9d3))
- **dbx-components-mcp:** added untagged model rules to validator ([51d64104](https://github.com/dereekb/dbx-components/commit/51d641045c8c1c6a3f939a2f8fe81bb84041185b))
- fix anchor selection misfire ([05957475](https://github.com/dereekb/dbx-components/commit/05957475167d534df86ad9d765bdb0f8d0f53b81))

## [13.10.3](https://github.com/dereekb/dbx-components/compare/v13.10.2-dev...v13.10.3) (2026-04-30)


### Bug Fixes

- **dbx-form:** forge form-field wrapper Material CSS leak ([e55ae02c](https://github.com/dereekb/dbx-components/commit/e55ae02c16c601e8f92afdc457b80b87a14b2c9f))


### Code Refactoring

- added SessionRecording to DbxAnalyticsStreamEventType ([9d39e709](https://github.com/dereekb/dbx-components/commit/9d39e7090b053f9257cc4b344a9606975c0508d9))
- **dbx-components-mcp:** added dbx_mcp_config tool ([f2e5658c](https://github.com/dereekb/dbx-components/commit/f2e5658c1fa96b243fb2cfbdbbe21b6b7a34018c))
- **dbx-components-mcp:** added downstream model search/lookup ([63ea1065](https://github.com/dereekb/dbx-components/commit/63ea1065b7234cb04c5322e5abeaa139c5c8a97f))
- lint-fix ([408a532d](https://github.com/dereekb/dbx-components/commit/408a532d5a5e2c7b1ee71092fdbff5c10a73de11))
- update CLAUDE.md ([dbd89f7d](https://github.com/dereekb/dbx-components/commit/dbd89f7d5d1ecb7b981c232b196186ac24591925))
- updated dbx-components-mcp ([6bcfa2d4](https://github.com/dereekb/dbx-components/commit/6bcfa2d4616ae024b1ba4dec26dd91a93e6bcb0d))
- updated ng-forge version to 0.8.0 ([369f23b1](https://github.com/dereekb/dbx-components/commit/369f23b1145a6438ca6624ced8719ab12825cd80))

## [13.10.2](https://github.com/dereekb/dbx-components/compare/v13.10.1-dev...v13.10.2) (2026-04-29)


### Bug Fixes

- **dbx-form:** forge enforceStep validator on empty number input ([799e388c](https://github.com/dereekb/dbx-components/commit/799e388cb26b0c1ea8df01892f3e770ee18a56c5))


### Code Refactoring

- added DbxFormLoggerDirective ([a77bd17f](https://github.com/dereekb/dbx-components/commit/a77bd17f86a69cb0d453896153dd01044c336857))
- **dbx-components-mcp:** added FirestoreCollectionKind taxonomy ([9db2bb7c](https://github.com/dereekb/dbx-components/commit/9db2bb7cf865f32feae779bc368745d1f788f048))
- **dbx-components-mcp:** added model-fixture tools ([809dfcce](https://github.com/dereekb/dbx-components/commit/809dfccec8d62bd7ad160d481d55c5c5f10d8a2e))
- **dbx-form:** forge preset mat-input styles ([52e3bcfb](https://github.com/dereekb/dbx-components/commit/52e3bcfbcaed83b20ca11104dbcbb24ad3fc4e1a))

## [13.10.1](https://github.com/dereekb/dbx-components/compare/v13.10.0-dev...v13.10.1) (2026-04-28)


### Bug Fixes

- **dbx-form:** deduplicate searchable field type defs ([ec3e7a21](https://github.com/dereekb/dbx-components/commit/ec3e7a217520296fb030e07976c03e230a20f480))
- **dbx-form:** extract _formConfig from nested forge fields ([4e5d90e3](https://github.com/dereekb/dbx-components/commit/4e5d90e39ba7db69b7d6dd65512abb4a4dea186a))
- **dbx-form:** integrate ng-forge fixes ([34c22fe5](https://github.com/dereekb/dbx-components/commit/34c22fe5f56084ef7ed4971c3ff23298a3246729))
- removed leading ./ from package bin paths ([7960381f](https://github.com/dereekb/dbx-components/commit/7960381fb0c42beb4d096fd2e0a2fa2710f89ed7))


### Build System

- **$workspace:** update deps to latest minor versions ([3df46308](https://github.com/dereekb/dbx-components/commit/3df4630876605ff90a9329bf9869ed29c208f24b))
- lint fix ([873422e9](https://github.com/dereekb/dbx-components/commit/873422e992ff9c6dd0e419b438ad0c1b2c57234b))


### Code Refactoring

- address sonarqube findings across packages ([67e167c1](https://github.com/dereekb/dbx-components/commit/67e167c1e5b9f1be4fc7f5be3baad17d8402e53a))
- address sonarqube phase 1 mechanical and phase 2 lint fixes ([3af63e62](https://github.com/dereekb/dbx-components/commit/3af63e622d7e950ccfbce6e372e326cb6d1dda99)), closes [String#replaceAll](https://github.com/dereekb/String/issues/replaceAll) [String#replace](https://github.com/dereekb/String/issues/replace)
- boolean fields use form-field wrapper ([54f72a29](https://github.com/dereekb/dbx-components/commit/54f72a29933040cf82a1086619d9e4b8215a0945))
- **dbx-form:** clickable box for forge checkbox/toggle ([c6381812](https://github.com/dereekb/dbx-components/commit/c638181212138f9e7ed4d2d87ae1570db4dc82b4))
- **dbx-form:** dbxForgeFlexLayout takes config object ([894a8286](https://github.com/dereekb/dbx-components/commit/894a82861da44651f782abf377ed46acb4bb0727))
- text address test fixes ([7c62dc68](https://github.com/dereekb/dbx-components/commit/7c62dc68e2e8f8910cfeb1d3604cd34f9c09d70c))
- **util:** add stripObject for filtering empty pojos ([f9255d3b](https://github.com/dereekb/dbx-components/commit/f9255d3b3c05159284c200b44d0569eca95becf5))


### Tests

- **dbx-form:** cover state field idempotentTransform wiring ([9336a456](https://github.com/dereekb/dbx-components/commit/9336a456fbbd2acdfc8f0fb9d6d63c1a26d39781))

# [13.10.0](https://github.com/dereekb/dbx-components/compare/v13.9.0-dev...v13.10.0) (2026-04-27)


### Bug Fixes

- drop emulator option from app template root.app.config ([790c990c](https://github.com/dereekb/dbx-components/commit/790c990c9098bddf85fa9e003c2d1c498ebc436a))
- eagerly init firebase services in provideDbxFirebaseApp ([eb95556a](https://github.com/dereekb/dbx-components/commit/eb95556a5a57138c4048373f5b8b5bf386c7de28))
- zoho-cli test invalid choice checks pass --fields ([f7d036df](https://github.com/dereekb/dbx-components/commit/f7d036df852e91c857bba6d1d395e15d7a758f83))


### Build System

- lint fix ([4c892384](https://github.com/dereekb/dbx-components/commit/4c892384af65b8a491f58cab1fd3c1b981fed2d3))


### Code Refactoring

- require key on dbxForgeGroup, add dbxForgeContainer ([9fbeec6c](https://github.com/dereekb/dbx-components/commit/9fbeec6c8ad227e229b2c8ce3eea3127c7c5a48d))
- zoho-cli multi-page pagination flags ([e95817dd](https://github.com/dereekb/dbx-components/commit/e95817ddb0117098feb76dcce051e0de10fd2018))


### Features

- dbx-components-mcp ([#47](https://github.com/dereekb/dbx-components/issues/47)) ([e68b16a6](https://github.com/dereekb/dbx-components/commit/e68b16a66018a307ef55a4ef9cbccec6657128d8)), closes [#47](https://github.com/dereekb/dbx-components/issues/47) [hi#complexity](https://github.com/dereekb/hi/issues/complexity) [Array#sort](https://github.com/dereekb/Array/issues/sort) [Array#push](https://github.com/dereekb/Array/issues/push) [Array#push](https://github.com/dereekb/Array/issues/push) [hi#complexity](https://github.com/dereekb/hi/issues/complexity) [#47](https://github.com/dereekb/dbx-components/issues/47) [Array#at](https://github.com/dereekb/Array/issues/at)

# [13.9.0](https://github.com/dereekb/dbx-components/compare/v13.8.0-dev...v13.9.0) (2026-04-23)


### Bug Fixes

- forge searchable field anchor click propagation ([93ac96bd](https://github.com/dereekb/dbx-components/commit/93ac96bdab6ccb12260f4519e9d4d51ab8a09cc9))


### Code Refactoring

- add ARIA accessibility to all forge field components ([5ccc72b9](https://github.com/dereekb/dbx-components/commit/5ccc72b923b114b5a17c523bb952056393f1d011))
- add forge value-selection field and action dialog ([2ce9048c](https://github.com/dereekb/dbx-components/commit/2ce9048c5ba62382f2b6ad56227843b88dea494b))
- add logic support to all forge field configs ([ec888712](https://github.com/dereekb/dbx-components/commit/ec8887123d60a2100e0c7deeb9559ca7c50d801e))
- derive cli skip-command set from grouped arrays ([e9928f7e](https://github.com/dereekb/dbx-components/commit/e9928f7e96ba98b39f895c8e3d9c6aa3f20a7fda))
- fixes ([3526e6a0](https://github.com/dereekb/dbx-components/commit/3526e6a065646960aca531bb7380b3d737afdcaf))
- improve forge source select and pickable list fields ([b8162199](https://github.com/dereekb/dbx-components/commit/b8162199573fed6a4301c4dbe4112c5ca969451f))
- ng-forms ([#46](https://github.com/dereekb/dbx-components/issues/46)) ([a16b8bb9](https://github.com/dereekb/dbx-components/commit/a16b8bb9c94e782f71dc9f8d515a0053013efb48)), closes [#46](https://github.com/dereekb/dbx-components/issues/46)
- updated zoho-cli output config ([1fbcad1c](https://github.com/dereekb/dbx-components/commit/1fbcad1c90d57216702ed662e85f84b0d3c4ba56))
- use specific field def types in forge registry ([783b8eac](https://github.com/dereekb/dbx-components/commit/783b8eac5ed31b065586e2b611a35bc1e08eae04))


### Features

- zoho desk, zoho cli ([#45](https://github.com/dereekb/dbx-components/issues/45)) ([eab5b5a7](https://github.com/dereekb/dbx-components/commit/eab5b5a7e5ab31d897ecf9454b32e55e80191517)), closes [#45](https://github.com/dereekb/dbx-components/issues/45)

# [13.8.0](https://github.com/dereekb/dbx-components/compare/v13.7.0-dev...v13.8.0) (2026-04-11)


### Bug Fixes

- package.json to reduce vulnerabilities ([#44](https://github.com/dereekb/dbx-components/issues/44)) ([f1bfbad3](https://github.com/dereekb/dbx-components/commit/f1bfbad3557033da982c3a2f3f26c70ebd73f0ae)), closes [#44](https://github.com/dereekb/dbx-components/issues/44)


### Code Refactoring

- added password reset service and UI ([76e0dd36](https://github.com/dereekb/dbx-components/commit/76e0dd36c7ff8cdfa03e94fbeb9ae09c53c4c216))
- fixes, disable snyk ([978142bf](https://github.com/dereekb/dbx-components/commit/978142bf3a50f927be8e9430734cbcd7e950342f))
- lint fixes and no-else-return refactoring ([6b88663d](https://github.com/dereekb/dbx-components/commit/6b88663dfbd3929f509a4b337e2592fbfe7bba9d))
- package.json fixes ([b3331056](https://github.com/dereekb/dbx-components/commit/b333105687c6bc83c7163f8dcf1766f20cb53be8))
- remove @angular/fire ([ccf2e030](https://github.com/dereekb/dbx-components/commit/ccf2e03094bcf365f7b087b92933c9e7dd5ce024))
- removed deprecated forge code ([971012bb](https://github.com/dereekb/dbx-components/commit/971012bbb4a6c18076c20f088c1cac8d22e65b72))
- use formly-prefixed names in dbx-form internals ([aa78aa79](https://github.com/dereekb/dbx-components/commit/aa78aa79354f2825403fae526290de06ecc8a5f8))


### Features

- ng-forge ([#43](https://github.com/dereekb/dbx-components/issues/43)) ([66dda79b](https://github.com/dereekb/dbx-components/commit/66dda79bdedd1f0940ef2fec01b2cd0b1516a97f)), closes [#43](https://github.com/dereekb/dbx-components/issues/43)

# [13.7.0](https://github.com/dereekb/dbx-components/compare/v13.6.17-dev...v13.7.0) (2026-04-09)


### Bug Fixes

- prevented duplicate item accumulation on page re-emission ([5c41aee4](https://github.com/dereekb/dbx-components/commit/5c41aee4ccab715342e6b29566207acca53937de))


### Build System

- lint fix ([366d95f4](https://github.com/dereekb/dbx-components/commit/366d95f48e9fb0c0fe802415b315851d672b53fa))


### Code Refactoring

- misc fixes ([ee820bd5](https://github.com/dereekb/dbx-components/commit/ee820bd5e03e09fa5d7033e3e762e729963e5556))


### Features

- added dbx-detach interaction type ([39024659](https://github.com/dereekb/dbx-components/commit/390246598dbffb7cc90a754bc8f59bdaa2a389d0))
- callModel api ([#42](https://github.com/dereekb/dbx-components/issues/42)) ([a0a05fd5](https://github.com/dereekb/dbx-components/commit/a0a05fd549d927548dd7569067828dbe62d90ae8)), closes [#42](https://github.com/dereekb/dbx-components/issues/42)

## [13.6.17](https://github.com/dereekb/dbx-components/compare/v13.6.16-dev...v13.6.17) (2026-04-08)


### Code Refactoring

- added EMPTY_ARKTYPE_TYPE and emptyType() utility ([b37e1376](https://github.com/dereekb/dbx-components/commit/b37e1376c90e3966bf8052fdcbfe6256affba41e))
- added encrypted pdf utility ([ebb2f8e1](https://github.com/dereekb/dbx-components/commit/ebb2f8e18f4e7337b4a8f03fff908510c1756f19))
- added maxRetries config to ZohoRateLimitedFetchHandlerConfig ([71cb5b23](https://github.com/dereekb/dbx-components/commit/71cb5b2303ed647a95020e1c2d9a8ed3b867262c))
- exported download multiple files min/max constants ([84195b16](https://github.com/dereekb/dbx-components/commit/84195b1687cc72297648d9f66878cdf37a9b8432))

## [13.6.16](https://github.com/dereekb/dbx-components/compare/v13.6.15-dev...v13.6.16) (2026-04-03)


### Code Refactoring

- improved dbx-button icon-only styling ([f4b04c47](https://github.com/dereekb/dbx-components/commit/f4b04c477d98533fca17c607d201a71062960153))
- updated DbxNavbarComponent button mode ([c2a3781b](https://github.com/dereekb/dbx-components/commit/c2a3781b111e8ea518cfde17e808bd77878734ae))

## [13.6.15](https://github.com/dereekb/dbx-components/compare/v13.6.14-dev...v13.6.15) (2026-04-03)


### Bug Fixes

- **date:** fix cross-timezone minMaxDateRange index ([1282aae7](https://github.com/dereekb/dbx-components/commit/1282aae7b02dd0ea6dd2ed38273aa2595c4dfdd4))


### Code Refactoring

- added allowedModes input to DbxSidenavComponent ([82ea8443](https://github.com/dereekb/dbx-components/commit/82ea84436808fb127c10cfe50068ea493a5395ee))

## [13.6.14](https://github.com/dereekb/dbx-components/compare/v13.6.13-dev...v13.6.14) (2026-04-02)


### Build System

- lint fix ([46d9ad19](https://github.com/dereekb/dbx-components/commit/46d9ad1959b55508b7766cc097672883ee6b0c8e))


### Code Refactoring

- added @dereekb/nestjs/eslint sub-entry ([0ed211b0](https://github.com/dereekb/dbx-components/commit/0ed211b07a9ba61d0f758e186c0beb0e5021ffe0))
- added sidenav position, displayMode, and css tokens ([301bd3d6](https://github.com/dereekb/dbx-components/commit/301bd3d60d7adc2fe291e18a79486f8f308ae4c9))
- added type-only import detection to rule ([72f6ee3d](https://github.com/dereekb/dbx-components/commit/72f6ee3db8729f0d2348164dc545b895421a8b89))
- arktype fixes ([a5a22a93](https://github.com/dereekb/dbx-components/commit/a5a22a939b63e009bd702e6f663f0946729ecb5d))

## [13.6.13](https://github.com/dereekb/dbx-components/compare/v13.6.12-dev...v13.6.13) (2026-04-01)


### Code Refactoring

- lint-fix ([95f023dd](https://github.com/dereekb/dbx-components/commit/95f023ddd2980d78d0f2065fc491e90e9894b970))
- updated UnitedStatesAddress to use Maybe ([7256616a](https://github.com/dereekb/dbx-components/commit/7256616afda2580316b08b4135bad11a8f9fe667))


### Continuous Integration

- renamed publish-npmjs to ci-publish-npmjs ([fb62c82f](https://github.com/dereekb/dbx-components/commit/fb62c82f83c637ba01c29c21f8f62bc8a0fb7c44))

## [13.6.12](https://github.com/dereekb/dbx-components/compare/v13.6.11-dev...v13.6.12) (2026-04-01)


### Build System

- lint fix ([d3768833](https://github.com/dereekb/dbx-components/commit/d37688338d3021d8d46ad29415a3b9c47f38a34a))
- lint fix ([31ad7c0f](https://github.com/dereekb/dbx-components/commit/31ad7c0f1a3a8d5abacb884dd4af8ea6e6dafc6f))


### Code Refactoring

- added clearable() to optional arktype fields ([ec5f46a6](https://github.com/dereekb/dbx-components/commit/ec5f46a646b07df15a7cb2f98e5b534772c2ab16))
- added timeDurationField with text parsing and popover picker ([e41c12af](https://github.com/dereekb/dbx-components/commit/e41c12afab184ce3a74c72d584066bb4433781a7))
- fixes ([0eb0ef3a](https://github.com/dereekb/dbx-components/commit/0eb0ef3a8870fa2d85fbf64b77c35f0bc1f37573))

## [13.6.11](https://github.com/dereekb/dbx-components/compare/v13.6.10-dev...v13.6.11) (2026-03-30)


### Code Refactoring

- added batch StorageFile download API ([bbcaef10](https://github.com/dereekb/dbx-components/commit/bbcaef10c37c931de21bc8dd983ef1d15e2520d9))
- fixed vitest automatic isolate ([a0b5fd31](https://github.com/dereekb/dbx-components/commit/a0b5fd313c95db6191b7eb888f50abbbfec8f8dc))
- zoho sign template id ([0d0bd2e8](https://github.com/dereekb/dbx-components/commit/0d0bd2e8cacf7e2617e2a327e3f31fa767e0ff3b))

## [13.6.10](https://github.com/dereekb/dbx-components/compare/v13.6.9-dev...v13.6.10) (2026-03-28)


### Bug Fixes

- used fixed date in getDateCellTimingFirstEventDateRange test ([8ee25396](https://github.com/dereekb/dbx-components/commit/8ee25396fcf2e69ddc1162b085f163f60ed745ba))


### Code Refactoring

- added cross-platform AssetLoader utility ([2acd4d09](https://github.com/dereekb/dbx-components/commit/2acd4d09369971b76bb204a37218f48cf94e189f))
- added discord public key format validation ([ab202ea9](https://github.com/dereekb/dbx-components/commit/ab202ea9b235338e6af7dc3d51e0aac890babec0))
- fixed build issue ([c7f88d34](https://github.com/dereekb/dbx-components/commit/c7f88d34a8aed9d2b21db3cbfe5da6e181d7bdfd))
- unified navbar-like overflow handling with dbx-flex-bar ([ccd2c790](https://github.com/dereekb/dbx-components/commit/ccd2c79086bba0a5e47a37e71e5132d7189cfd30))
- updated automatic isolate for vitest ([cc5c63fc](https://github.com/dereekb/dbx-components/commit/cc5c63fcc34fdbdea23305a21ca53f04c085672b))

## [13.6.9](https://github.com/dereekb/dbx-components/compare/v13.6.8-dev...v13.6.9) (2026-03-27)


### Code Refactoring

- vitest import fixes ([5f7123b3](https://github.com/dereekb/dbx-components/commit/5f7123b3f88aba868db0398244acd68aea541700))

## [13.6.8](https://github.com/dereekb/dbx-components/compare/v13.6.7-dev...v13.6.8) (2026-03-27)


### Bug Fixes

- accordion trackId collision across groups ([a17009f8](https://github.com/dereekb/dbx-components/commit/a17009f8c2d2426f7fe16fe99e5efa006ca32d24))


### Code Refactoring

- made mapValuesToItemValues required ([9bbf2298](https://github.com/dereekb/dbx-components/commit/9bbf229856399f96552bac6a3611ad3f33833b69))
- required key on DbxValueListItem ([3e26491b](https://github.com/dereekb/dbx-components/commit/3e26491b4bc0414080be7f0daef32c076294bf59))

## [13.6.7](https://github.com/dereekb/dbx-components/compare/v13.6.6-dev...v13.6.7) (2026-03-27)


### Checkpoints

- firestore collection cache ([f00f9a0d](https://github.com/dereekb/dbx-components/commit/f00f9a0d96e425f5fc9c5a48d031c7a4912bab61))


### Code Refactoring

- dbx-button-wrap-group supports dbx-anchor ([e43922be](https://github.com/dereekb/dbx-components/commit/e43922be7e5d5d8a3c0cdb0bd4ce39f0b3dbe6b7))
- fixes ([7806860a](https://github.com/dereekb/dbx-components/commit/7806860a5b5cd4fc8c8fa241973937bc80c1c486))
- flat accordion view with stickyHeaders config ([5f813813](https://github.com/dereekb/dbx-components/commit/5f813813aafc3826fce50ffd287fa326de54485b))
- moved vitest config and setup into @dereekb/vitest ([3958a96c](https://github.com/dereekb/dbx-components/commit/3958a96c2e4d05b7809ed28b6eed58b3a59415e1))
- parallel vitest workers for firebase tests ([e06e42a3](https://github.com/dereekb/dbx-components/commit/e06e42a39d3e4c99cabec98023f8bfa64b0f84e7))

## [13.6.6](https://github.com/dereekb/dbx-components/compare/v13.6.5-dev...v13.6.6) (2026-03-26)


### Bug Fixes

- appWebhookUrl missing globalApiRoutePrefix ([37a39f7b](https://github.com/dereekb/dbx-components/commit/37a39f7b00ff764cfdcc241b6ba3fcc813096e59))
- mapbox drawer button background not rendering ([59592051](https://github.com/dereekb/dbx-components/commit/59592051d12e98821e54613d26973404c6ba95f8))


### Code Refactoring

- added Count semantic number type ([4869d676](https://github.com/dereekb/dbx-components/commit/4869d676711446989f95c0bda7d9de5d24f39df4))
- synced setup-project.sh dep versions ([d99faf7b](https://github.com/dereekb/dbx-components/commit/d99faf7b27c3c4727dd3265823d07cfe8ac4cbba))

## [13.6.5](https://github.com/dereekb/dbx-components/compare/v13.6.4-dev...v13.6.5) (2026-03-25)


### Bug Fixes

- login button content not rendering ([a13cc472](https://github.com/dereekb/dbx-components/commit/a13cc4725cc59de03a178a368c581dbf48876364))


### Code Refactoring

- added configurable drawerWidth to DbxMapboxConfig ([554599b9](https://github.com/dereekb/dbx-components/commit/554599b996eef587f683a36e1dc7cd12a9174e3f))
- detect projected content for icon-only buttons ([add74404](https://github.com/dereekb/dbx-components/commit/add74404575aeb9c7178cd6f38adfd95de8ae4a6))
- style fixes ([d37306aa](https://github.com/dereekb/dbx-components/commit/d37306aab3e7dd55407dfcfdbf5535eae4a162c7))
- style fixes and mdc-to-mat token updates ([c7815e62](https://github.com/dereekb/dbx-components/commit/c7815e62b765fe507f1c21ac17a0b657024fc404))

## [13.6.4](https://github.com/dereekb/dbx-components/compare/v13.6.3-dev...v13.6.4) (2026-03-24)


### Build System

- lint fix ([01b33c02](https://github.com/dereekb/dbx-components/commit/01b33c0214d7963822dbf3cb7df822a788958e2e))


### Checkpoints

- button echo overlay and icon fixes ([4f7c4f10](https://github.com/dereekb/dbx-components/commit/4f7c4f10f9995a69c029144f74fbca16a3df8956))


### Code Refactoring

- added echo overlay support to bar button ([a39e3102](https://github.com/dereekb/dbx-components/commit/a39e3102f1737a8307e78c8014ce5e24552ac051))
- added typeform source tracking URL parameter types ([32c60b4f](https://github.com/dereekb/dbx-components/commit/32c60b4fd69cfb729e069b26897b54b5e60aa756))
- button echo fixes and demo updates ([701eabc1](https://github.com/dereekb/dbx-components/commit/701eabc1fc0d4cb75ce67dee215634ef7a0fc7e9))
- button spinner color and interaction fixes ([5d69550c](https://github.com/dereekb/dbx-components/commit/5d69550c1616f83d40aeb760c77de7261d4e647b))
- fixed bar button echo and icon positioning ([d96de6d2](https://github.com/dereekb/dbx-components/commit/d96de6d26ba98f54d7f1c8f72dda3381a2e7001c))

## [13.6.3](https://github.com/dereekb/dbx-components/compare/v13.6.2-dev...v13.6.3) (2026-03-24)


### Bug Fixes

- intphone field not marking form dirty/touched ([29b1ac8f](https://github.com/dereekb/dbx-components/commit/29b1ac8fe4c13d48374fbd901a3c55427d91d2c8))


### Code Refactoring

- added config input to DbxStepBlockComponent ([1cf91678](https://github.com/dereekb/dbx-components/commit/1cf91678b157b7990fae63fbff71d32d18c714f0))
- added type-to-filter for sourceSelectField ([e7b07986](https://github.com/dereekb/dbx-components/commit/e7b0798699d505be0dae77d06f4e17b89d046a95))
- added TypeformPublicFormUrl ([4dfb22f4](https://github.com/dereekb/dbx-components/commit/4dfb22f4b566d66bda8f1ea1a06c84036ef0d869))
- added updateUrlSearchParams utility ([c06b40ba](https://github.com/dereekb/dbx-components/commit/c06b40ba50d367f722cd7f907f03816a542e5f73))
- upgraded stripe sdk from v9 to v20 ([11d0cb6e](https://github.com/dereekb/dbx-components/commit/11d0cb6e132161cfc3c5be018a5e57276138b572))


### Demo

- added bug tests section to demo app ([c1097bfc](https://github.com/dereekb/dbx-components/commit/c1097bfcec5e1f498e782a17303cbb1541f1a833))

## [13.6.2](https://github.com/dereekb/dbx-components/compare/v13.6.1-dev...v13.6.2) (2026-03-23)


### Bug Fixes

- removed OnCallModelAnalyticsResolver to fix test hang ([eb7d5e2a](https://github.com/dereekb/dbx-components/commit/eb7d5e2a84c615499f0a2822254f440c6fc377e1))

## [13.6.1](https://github.com/dereekb/dbx-components/compare/v13.6.0-dev...v13.6.1) (2026-03-23)


### Bug Fixes

- dbxFormSource reset mode feedback loop ([a8c7b5aa](https://github.com/dereekb/dbx-components/commit/a8c7b5aa6706c01b3a42288c3a165afcf40a83ef))
- optional analytics provider crashes on missing token ([a9a3feb8](https://github.com/dereekb/dbx-components/commit/a9a3feb831d6e8b566d5279ea7e550b7bec0ce4e))


### Code Refactoring

- added DbxStepBlockComponent, removed old step layout ([c48da438](https://github.com/dereekb/dbx-components/commit/c48da43890dae2b46095a56825ef1e0203205ffc))
- added env service API and webhook URL fields ([859ef3c0](https://github.com/dereekb/dbx-components/commit/859ef3c02ffe36f68759c9ae59e93eeffff5ec13))
- allow Maybe for auth init user inputs ([2e773475](https://github.com/dereekb/dbx-components/commit/2e7734752e25ef157b4b3492bb97006702bca90e))
- allow Maybe for DbxButtonStyle and inputs ([eedeee25](https://github.com/dereekb/dbx-components/commit/eedeee2571555d27e6758217885ea6fdd6f09f43))
- chip interfaces extend LabeledValue ([097c4479](https://github.com/dereekb/dbx-components/commit/097c447910239b6c0449cbb5bfef3300c64bfa24))

# [13.6.0](https://github.com/dereekb/dbx-components/compare/v13.5.2-dev...v13.6.0) (2026-03-23)


### Code Refactoring

- cleanup ([9e06519d](https://github.com/dereekb/dbx-components/commit/9e06519d18a86774e1a8858990909316afc5cef6))
- fixed tonal color system regressions ([de3eef66](https://github.com/dereekb/dbx-components/commit/de3eef66aab9c464d11e78c36d6085f4dee7c562))


### Features

- a11y support ([#41](https://github.com/dereekb/dbx-components/issues/41)) ([244b4f4d](https://github.com/dereekb/dbx-components/commit/244b4f4d84884c8659ba05ecb5d0d16d7a15469c)), closes [#41](https://github.com/dereekb/dbx-components/issues/41)

## [13.5.2](https://github.com/dereekb/dbx-components/compare/v13.5.1-dev...v13.5.2) (2026-03-22)


### Code Refactoring

- added DbxChipListComponent, tonal color system ([da097523](https://github.com/dereekb/dbx-components/commit/da097523ae52746dbbfe2af599fadd9b19e6e844))
- fixed anchor list active styling ([fd64b889](https://github.com/dereekb/dbx-components/commit/fd64b88996ce64d345e655d8fd57ca47e2511fe8))
- updated cleanupDestroyable() to support Maybe ([a80f9859](https://github.com/dereekb/dbx-components/commit/a80f98593bed57a22e22e962c46329e09e808efc))

## [13.5.1](https://github.com/dereekb/dbx-components/compare/v13.5.0-dev...v13.5.1) (2026-03-22)


### Bug Fixes

- reverted [...Set] spreads to Array.from() ([fc712166](https://github.com/dereekb/dbx-components/commit/fc712166daaeecad86411f4dd8e38c9de19989f6))


### Code Refactoring

- added unlink mode and confirm skip to login ([1a7dfabc](https://github.com/dereekb/dbx-components/commit/1a7dfabc53436d77bf5f1fb9dd4d552733cc38c2))

# [13.5.0](https://github.com/dereekb/dbx-components/compare/v13.4.2-dev...v13.5.0) (2026-03-22)


### Bug Fixes

- fixed flaky jwks rotation test ([56039ab4](https://github.com/dereekb/dbx-components/commit/56039ab4b4a8c424566c3aa1216bc0fed3804cc3))


### Code Refactoring

- added missing dependency ([bfa92abf](https://github.com/dereekb/dbx-components/commit/bfa92abfdef61eb29687c248997c046de8cf0fda))
- added tryConvertToE164PhoneNumber() ([85ccbbd8](https://github.com/dereekb/dbx-components/commit/85ccbbd8866dbc3492625654bd3111fb5372db41))
- type fixes ([3545484d](https://github.com/dereekb/dbx-components/commit/3545484d6c88ea299dff4bd00e82e27f505c7ea2))


### Demo

- updated landing page package list ([0d384933](https://github.com/dereekb/dbx-components/commit/0d384933337e1f52349e14386de08661fa006180))


### Features

- angular material m3 ([#40](https://github.com/dereekb/dbx-components/issues/40)) ([ad91169d](https://github.com/dereekb/dbx-components/commit/ad91169d28118e63e4a2108d0e4d27cc7eda8a27)), closes [#40](https://github.com/dereekb/dbx-components/issues/40)

## [13.4.2](https://github.com/dereekb/dbx-components/compare/v13.4.1-dev...v13.4.2) (2026-03-20)


### Build System

- added return-await rule and lint fixes ([b77e288b](https://github.com/dereekb/dbx-components/commit/b77e288b9bfdde8761c99c05f816d6470e3f8439))
- resolved all lint warnings in firebase-server ([1f83bc06](https://github.com/dereekb/dbx-components/commit/1f83bc0625795f57e200a95ecf1ae70329cd8324))


### Code Refactoring

- lint-fix ([5cd64869](https://github.com/dereekb/dbx-components/commit/5cd648694652bfde63ab0cd4ea2c171650247ecf))
- lint-fix analytics, browser, dbx-firebase ([07c8f7d9](https://github.com/dereekb/dbx-components/commit/07c8f7d9e988a3b8181f02fc5412c40d8e631399))
- lint-fix firebase-server, dbx-core, dbx-web ([de170163](https://github.com/dereekb/dbx-components/commit/de170163304f0a4317e57cb1a3b22023934f7be4))




## [13.4.1](https://github.com/dereekb/dbx-components/compare/v13.4.0-dev...v13.4.1) (2026-03-20)


### Bug Fixes

- restored runtime null guards removed by lint ([d9b38b8f](https://github.com/dereekb/dbx-components/commit/d9b38b8fac9f1ee121a01a239ecef02122281590))


### Build System

- expanded eslint rules and plugins ([1503450d](https://github.com/dereekb/dbx-components/commit/1503450d388db10599657a2a1e25e65590e3777c))
- lint fixes and test coverage for util ([5203111a](https://github.com/dereekb/dbx-components/commit/5203111aacc79691f0fdcd8229eacad3e2b34783))
- resolved all lint warnings in nestjs, zoom, zoho ([48d47463](https://github.com/dereekb/dbx-components/commit/48d4746343db7ccb50af60de84e27d8421f269a5))
- resolved all lint warnings in util ([007c20c8](https://github.com/dereekb/dbx-components/commit/007c20c8446e5436d19b81c181be6d4cac1b63f6))


### Code Refactoring

-  nx.json update ([f8357192](https://github.com/dereekb/dbx-components/commit/f835719266d463d0ff6e90cafee904f51e32de2b))
- added sonar-project.properties ([a825e232](https://github.com/dereekb/dbx-components/commit/a825e2328caa610eba1dfe38372666da4a255c41))
- added typed auth error classes and nestApplication alias ([bef853e3](https://github.com/dereekb/dbx-components/commit/bef853e3c681f9318e8bea540c5dfe5f24668a71))
- circleci cache fix ([6c0390dc](https://github.com/dereekb/dbx-components/commit/6c0390dcce6dbc034e01a99ea8a022f21f45a14c))
- convention fixes for dbx-core and dbx-web ([5e514368](https://github.com/dereekb/dbx-components/commit/5e514368fc44e00df9db5efed837d46bd888bca8))
- convention fixes for zoom and zoho packages ([bd43391d](https://github.com/dereekb/dbx-components/commit/bd43391d87216fb74bad02373d7afe1a5bdb92f7))
- injection and list view improvements ([cbcb8c8f](https://github.com/dereekb/dbx-components/commit/cbcb8c8f61492333635da18e3a0c28aced7c2fe1))
- lint-fix ([4e50bdfc](https://github.com/dereekb/dbx-components/commit/4e50bdfc7a643a319a5fa957cd02b4998e568ca7))
- nestjs convention fixes across all sub-libraries ([2d0c57c3](https://github.com/dereekb/dbx-components/commit/2d0c57c3ac717dff025dc19f3ff3f4656ddaf559))


### Continuous Integration

- improve circleci caching and cleanup ([9de7abba](https://github.com/dereekb/dbx-components/commit/9de7abba99383f35a629816acb4c0e48a338cf90))
- staged builds, single emulator session, cache inputs ([327ef42e](https://github.com/dereekb/dbx-components/commit/327ef42e37a0a3b6a9c61c3362c4461019964362))


### Demo

- angular 21 convention updates ([42e44f97](https://github.com/dereekb/dbx-components/commit/42e44f97a52b88ab4e88339457a87a1042fe2999))




# [13.4.0](https://github.com/dereekb/dbx-components/compare/v13.3.1-dev...v13.4.0) (2026-03-18)


### Build System

- lint fix ([61238543](https://github.com/dereekb/dbx-components/commit/61238543024fffaf986c7d297d88fc9206c36502))


### Code Refactoring

- @dereekb/date convention fixes ([4dfa7632](https://github.com/dereekb/dbx-components/commit/4dfa76324678a7d5b7d80293e6ed5316e8a19b4b))
- added @dereekb/dbx-form/quiz entry point ([d7a4ce7b](https://github.com/dereekb/dbx-components/commit/d7a4ce7b4cb55635e75904f616ff5b51c4ff60e1))
- added isolate for vitest watch ([b7502ae7](https://github.com/dereekb/dbx-components/commit/b7502ae70dc68742780795044652e3a38e7569ee))
- added run_build param to circleci ([903d4ca1](https://github.com/dereekb/dbx-components/commit/903d4ca1488accf2900d263a0c908e457e8301b5))
- added zoho sign webhook controller ([d9b07225](https://github.com/dereekb/dbx-components/commit/d9b072256373cf018fa0e9de5a776beb09e17dbd))
- firebase, firebase-server conventions fixes ([8d9e0514](https://github.com/dereekb/dbx-components/commit/8d9e05142a317eb8b657cb04aa1333c80b82b9f0))
- model, analytics, rxjs convention fixes ([c05e4797](https://github.com/dereekb/dbx-components/commit/c05e4797a24d85469576c7090ad1767bd212752a))
- setup-project fix ([5f5531f1](https://github.com/dereekb/dbx-components/commit/5f5531f19abb70dcca30d6d206954fe423a003c6))


### Features

- cal.com integration ([#38](https://github.com/dereekb/dbx-components/issues/38)) ([16800338](https://github.com/dereekb/dbx-components/commit/16800338c26da4deeb4834f62f0e09f1a24c1454)), closes [#38](https://github.com/dereekb/dbx-components/issues/38)
- firebase-server analytics ([#39](https://github.com/dereekb/dbx-components/issues/39)) ([cf3b17e4](https://github.com/dereekb/dbx-components/commit/cf3b17e4c70dd06827f9ebf0d05292fc6e8b48bc)), closes [#39](https://github.com/dereekb/dbx-components/issues/39)




## [13.3.1](https://github.com/dereekb/dbx-components/compare/v13.3.0-dev...v13.3.1) (2026-03-16)


### Code Refactoring

- added missing package ([1845b7d9](https://github.com/dereekb/dbx-components/commit/1845b7d91062d9c6d6f9e4b7024142d462fd4d9b))
- updated @nestjs dependencies to latest ([15ab7bc8](https://github.com/dereekb/dbx-components/commit/15ab7bc8ea5ad6deb34a2b2a5949a0095b70c55d))


### Documentation

- jsdoc improvements across @dereekb/dbx-analytics ([67b5af21](https://github.com/dereekb/dbx-components/commit/67b5af2100706a7845445f2c6d55d231d9cadeed))




# [13.3.0](https://github.com/dereekb/dbx-components/compare/v13.2.2-dev...v13.3.0) (2026-03-14)


### Bug Fixes

- added missing dest to child ng-package.json files ([7095d4c7](https://github.com/dereekb/dbx-components/commit/7095d4c7caf9379b50f9d38394d59b5c2da8fb9d))


### Code Refactoring

- test fix ([68eb1dd6](https://github.com/dereekb/dbx-components/commit/68eb1dd6b9b52eb0eceeb23bfc0869e366c9780a))


### Documentation

- added jsdoc and tests for radix36 encoded ([6eaaf0df](https://github.com/dereekb/dbx-components/commit/6eaaf0df24b6cd402edbc1451357c7af78685c9d))
- jsdoc for firestore driver and supporting modules ([47390b01](https://github.com/dereekb/dbx-components/commit/47390b018c679740127db97b13a2119cf2bb40c8))
- jsdoc improvements across @dereekb/firebase ([e120ae51](https://github.com/dereekb/dbx-components/commit/e120ae5196079c873fa5f141f1ffe717ac7535e7))


### Features

- added oidc-provider ([#37](https://github.com/dereekb/dbx-components/issues/37)) ([be49c483](https://github.com/dereekb/dbx-components/commit/be49c4833ec3bfe71c1239f8b2eee3663e7320d9)), closes [#37](https://github.com/dereekb/dbx-components/issues/37)




## [13.2.2](https://github.com/dereekb/dbx-components/compare/v13.2.1-dev...v13.2.2) (2026-03-10)


### ai

- removed deprecated skills ([c4d231f7](https://github.com/dereekb/dbx-components/commit/c4d231f7f61c435beed6dd8332755db5c2e43d68))


### Code Refactoring

- added ARKTYPE_DATE_DTO_TYPE for Date | string.date.parse ([36350f75](https://github.com/dereekb/dbx-components/commit/36350f7517d8211140605fde24b0faa6bee803e9))


### Documentation

- added jsdoc annotations to dbx-core ([33f073cd](https://github.com/dereekb/dbx-components/commit/33f073cd0cca27a8aa58fad642012513cdbf0ec3))
- added jsdoc annotations to dbx-web ([d0ba93f2](https://github.com/dereekb/dbx-components/commit/d0ba93f20c68a879be3006941a4345581bfc89ef))
- added jsdoc to dbx-web loading, keypress, util, screen ([069caace](https://github.com/dereekb/dbx-components/commit/069caace0552073b115d41b2228b46f2bc294d1e))




## [13.2.1](https://github.com/dereekb/dbx-components/compare/v13.2.0-dev...v13.2.1) (2026-03-09)


### Code Refactoring

- added latLngPointType and latLngStringType ([684c8365](https://github.com/dereekb/dbx-components/commit/684c8365cdccab28fc500db3b9fea118570f0909))
- moved arktype types to date.model.ts ([d72d241f](https://github.com/dereekb/dbx-components/commit/d72d241fea628929bdc77202b6bc99c81b519aa2))
- updated withApiDetails to single config object ([f85ed106](https://github.com/dereekb/dbx-components/commit/f85ed106c08c4010c8291a025818b4a6c056f528))


### Documentation

- improved jsdocs for auth.service.ts ([b6dd8e34](https://github.com/dereekb/dbx-components/commit/b6dd8e3459d644d1309ef605387bcbdd41af6bc2))




# [13.2.0](https://github.com/dereekb/dbx-components/compare/v13.1.0-dev...v13.2.0) (2026-03-09)


### Bug Fixes

- arktype narrow null guard for type intersection ([ba3938ee](https://github.com/dereekb/dbx-components/commit/ba3938eeebe55cc595863b2b51299ef8bae3a763))


### Build System

- lint fix ([b0a2a3c5](https://github.com/dereekb/dbx-components/commit/b0a2a3c5e575bdf34eb9b2e59425814859ec3ece))


### Code Refactoring

- added firestoreEncryptedField to firebase-server ([9fdd3ee9](https://github.com/dereekb/dbx-components/commit/9fdd3ee94003c807d4905145e337e42cc6054972))


### Features

- added @dereekb/nestjs/discord integration ([#36](https://github.com/dereekb/dbx-components/issues/36)) ([4f9bc99e](https://github.com/dereekb/dbx-components/commit/4f9bc99ebba372e0e8bf243b1163f406b48093ba)), closes [#36](https://github.com/dereekb/dbx-components/issues/36)




# [13.1.0](https://github.com/dereekb/dbx-components/compare/v13.0.7-dev...v13.1.0) (2026-03-09)


### Bug Fixes

- dateCellTimingStartPair DST cross-timezone bug ([9d16da29](https://github.com/dereekb/dbx-components/commit/9d16da291dafe02bfd429d8974d250753180de90))


### Build System

- lint fix ([de0b6d1c](https://github.com/dereekb/dbx-components/commit/de0b6d1c5b523ec652fcca1c4fed06de9bb252ef))


### Code Refactoring

- updated jsdocs for util, rxjs, model, and date ([#34](https://github.com/dereekb/dbx-components/issues/34)) ([fe49828c](https://github.com/dereekb/dbx-components/commit/fe49828ca694f385f903843f599bfd3e0df47af7)), closes [#34](https://github.com/dereekb/dbx-components/issues/34)


### Features

- arktype migration ([#35](https://github.com/dereekb/dbx-components/issues/35)) ([fe87948b](https://github.com/dereekb/dbx-components/commit/fe87948bf30948352a55db18b0057bcd1b4673ee)), closes [#35](https://github.com/dereekb/dbx-components/issues/35)




## [13.0.7](https://github.com/dereekb/dbx-components/compare/v13.0.6-dev...v13.0.7) (2026-03-07)


### ai

- added dbx-merge-release skill ([68fd1941](https://github.com/dereekb/dbx-components/commit/68fd1941c1f4a5d7781a3a48adb4236898a5aba8))


### Bug Fixes

- resolved DST boundary bugs in date timezone calculations ([363f7ddf](https://github.com/dereekb/dbx-components/commit/363f7ddf675a081be3cabc99ec159c4d37cd774c))
- terminate firestore before cleanup in test teardown ([700f7372](https://github.com/dereekb/dbx-components/commit/700f7372093c9f1584151d1ee6c82a10a3ba9da6))


### Code Refactoring

- added bufferHasValidPdfMarkings() ([ac98fe91](https://github.com/dereekb/dbx-components/commit/ac98fe91307d712e261800f21395b34fa2d505fa))
- added build assets to zoho-nestjs project config ([b79fb1da](https://github.com/dereekb/dbx-components/commit/b79fb1da49bf4f31e2d66c64eb012f3505360d80))
- added fetchFileFromUrl() ([f6986802](https://github.com/dereekb/dbx-components/commit/f6986802db4868bb9f39a2ac7eb9699ab9f1dc4d))
- added snapshot cache for document accessor ([b3bee1b3](https://github.com/dereekb/dbx-components/commit/b3bee1b3a1416b60d9603cc1307e89a3dbdfcd46))
- added zoho sign api library ([a05b484c](https://github.com/dereekb/dbx-components/commit/a05b484c10951d2127e7d84963b71cc4046d8a94))
- updated firestore utilities and test config ([d5d0e382](https://github.com/dereekb/dbx-components/commit/d5d0e38223292bca36761517c66b71f544772323))
- updated jsdocs for query and pagination utilities ([21ff80b1](https://github.com/dereekb/dbx-components/commit/21ff80b1560ac6dff57c6774e4e9571f7e6ad4ce))
- updated jsdocs for zoho crm and recruit ([4da61f42](https://github.com/dereekb/dbx-components/commit/4da61f427658f96d9fdccc911ff1c696c4795956))
- updated zoho crm attachment upload to use File ([d098e6e2](https://github.com/dereekb/dbx-components/commit/d098e6e22f671a77e5755af25f9dc4980187e315))
- updated zoho sign/recruit api and fetch utils ([fb7f4dc7](https://github.com/dereekb/dbx-components/commit/fb7f4dc7f7bd6d08e03ec6e9f921b1fc7ff4171f))


### Continuous Integration

- added run_tests, run_setup_test pipeline parameter ([ac59c756](https://github.com/dereekb/dbx-components/commit/ac59c7561bd3fdaa32603da40ccf5aba507313f2))


### Documentation

- added jsdocs to zoho and zoho-nestjs packages ([67dee811](https://github.com/dereekb/dbx-components/commit/67dee81121b7f3a6de7d66fea17789d4ac3fdd36))
- added zoho crm getting started guide ([b73308d1](https://github.com/dereekb/dbx-components/commit/b73308d139bdd60eb27e1a5fa3f0294164623a83))




## [13.0.6](https://github.com/dereekb/dbx-components/compare/v13.0.5-dev...v13.0.6) (2026-03-05)


### Bug Fixes

- removed shareReplay from document.rxjs.ts streaming functions ([2377156c](https://github.com/dereekb/dbx-components/commit/2377156cffcd4d69643a1619d5762f6f7d7b5a3e))


### Code Refactoring

- added jsdocs to dbx-core rxjs components ([ef7538e9](https://github.com/dereekb/dbx-components/commit/ef7538e939b44b6ac9766fda7149f058e6042087))
- updated firestore document utilities, added tests ([c8c19d77](https://github.com/dereekb/dbx-components/commit/c8c19d7755c77ad9d6963fa09927fc331321b2f1))
- updated store jsdocs, commitlint types ([5ac28a9d](https://github.com/dereekb/dbx-components/commit/5ac28a9d135fcdc3dcd0d3e25208a86a1f592867))




## [13.0.5](https://github.com/dereekb/dbx-components/compare/v13.0.4-dev...v13.0.5) (2026-03-04)


### ai

- moved skills to .claude ([ae63e335](https://github.com/dereekb/dbx-components/commit/ae63e335c520a1df5acde6fa330c0a175b66fc2e))


### Build System

- lint fix ([02bb7ce9](https://github.com/dereekb/dbx-components/commit/02bb7ce97169a7b0b58a781c9700260a9f02a433))


### Checkpoints

- accordion view ([e25b39a4](https://github.com/dereekb/dbx-components/commit/e25b39a4f0115d9018e592f3c58d88afa33402b0))


### Code Refactoring

- updated dbx-grid, dbx-accordion ([84e8bb48](https://github.com/dereekb/dbx-components/commit/84e8bb48b3dacaa74d696049d27bf339ad3fd641))




## [13.0.4](https://github.com/dereekb/dbx-components/compare/v13.0.3-dev...v13.0.4) (2026-03-03)


### Build System

- lint fix ([a6f03496](https://github.com/dereekb/dbx-components/commit/a6f034962b8054b66f9c50f887c267bf94614d73))


### Code Refactoring

- fixed early destroy on components ([a5f3a4c3](https://github.com/dereekb/dbx-components/commit/a5f3a4c3fbe585a8d95b03f635966c7ed7107813))




## [13.0.3](https://github.com/dereekb/dbx-components/compare/v13.0.2-dev...v13.0.3) (2026-03-03)


### Code Refactoring

- sidenav fix ([b368b2eb](https://github.com/dereekb/dbx-components/commit/b368b2eb9356f770d31985f89c0095b35b4871ff))
- updated vitest config ([39ff2d2c](https://github.com/dereekb/dbx-components/commit/39ff2d2c400af6ce0c6f1e71d9be39f67411b908))




## [13.0.2](https://github.com/dereekb/dbx-components/compare/v13.0.1-dev...v13.0.2) (2026-03-02)


### Build System

- lint fix ([48618689](https://github.com/dereekb/dbx-components/commit/48618689d1ee25f5bbfd76067df998f82fb835b3))


### Code Refactoring

- added DbxLinkifyService ([b6168a92](https://github.com/dereekb/dbx-components/commit/b6168a92a3746d56092087d48f75bc499282c2ec))
- fixed DbxMapboxMapDirective ([c6ef917f](https://github.com/dereekb/dbx-components/commit/c6ef917f45fdc3e4f27600253d994577bf3026eb))
- ran angular migration on demo application ([c8a59020](https://github.com/dereekb/dbx-components/commit/c8a59020d5c232d7f26427b62c35dcf075cbf8ce))
- release fix ([d2bd7a02](https://github.com/dereekb/dbx-components/commit/d2bd7a020e0bc7a388970b38402fc5a611cf7702))
- style fixes ([ec4dc6d3](https://github.com/dereekb/dbx-components/commit/ec4dc6d3e54ff19994b5bb493a06e938a57cc4b6))
- updated setup-project.sh ([0c158987](https://github.com/dereekb/dbx-components/commit/0c158987df5b308377c5263df9d50ba105224ffc))




## [13.0.1](https://github.com/dereekb/dbx-components/compare/v13.0.0-dev...v13.0.1) (2026-02-27)


### Code Refactoring

- fixed release, sync'd package deps ([ee13cfb8](https://github.com/dereekb/dbx-components/commit/ee13cfb8bb3fa89a52adb09eb9e15014f9024155))
- package.json fixes ([1a352866](https://github.com/dereekb/dbx-components/commit/1a352866ec00824f285d9d9931002161ccb29ccf))
- release fix ([14093f0e](https://github.com/dereekb/dbx-components/commit/14093f0ed44c6bd339ab0c4f2d31e68ae362733b))
- removed babel usage ([eb68fa0f](https://github.com/dereekb/dbx-components/commit/eb68fa0fd0fc936b7e5b789725730d5face3122d))
- setup fixes ([8b5cbf8b](https://github.com/dereekb/dbx-components/commit/8b5cbf8b09fc92f53c645966cd19dd63cf0ea69f))
- test project fix ([9cb877ea](https://github.com/dereekb/dbx-components/commit/9cb877eafb9cb66018766d6490f6025038ec405b))
- update force-start-release.sh ([705c9c3b](https://github.com/dereekb/dbx-components/commit/705c9c3b2e38171eebf3e4a3319229764172afee))
- updated setup-project.sh ([e970f557](https://github.com/dereekb/dbx-components/commit/e970f55776168db8c227b3e2947f9b8496cbc964))
- version bumping fix ([01b0f89d](https://github.com/dereekb/dbx-components/commit/01b0f89d9df6a3aeb1b1906b1c42469b548e2a82))




# 13.0.0 (2026-02-27)

### 🚀 Features

- added setContainsAnyValue() ([ea0ee9a7](https://github.com/dereekb/dbx-components/commit/ea0ee9a7))
- added setContainsAnyValue() ([cc6d17ab](https://github.com/dereekb/dbx-components/commit/cc6d17ab))
- added dbxActionLoadingContextDirective ([c20aa028](https://github.com/dereekb/dbx-components/commit/c20aa028))
- added dbxActionFormDisabledWhileWorking to dbxActionForm ([4d6d67b3](https://github.com/dereekb/dbx-components/commit/4d6d67b3))
- added now to dbxDateTimeFieldComponent ([812e704b](https://github.com/dereekb/dbx-components/commit/812e704b))
- added dbxActionEnforceModified ([5a4c4b26](https://github.com/dereekb/dbx-components/commit/5a4c4b26))
- date query builder ([9adfe56b](https://github.com/dereekb/dbx-components/commit/9adfe56b))
- dbxActionPopoverDirective ([a808ac9a](https://github.com/dereekb/dbx-components/commit/a808ac9a))
- dbxActionDialogDirective ([63fb8717](https://github.com/dereekb/dbx-components/commit/63fb8717))
- added onMatchDelta ([e36fb4c4](https://github.com/dereekb/dbx-components/commit/e36fb4c4))
- added mapKeysIntersection utility functions ([f694f86b](https://github.com/dereekb/dbx-components/commit/f694f86b))
- added dbxAuthService ([9422182a](https://github.com/dereekb/dbx-components/commit/9422182a))
- added dbxFirebaseAuthModule ([3ab16dff](https://github.com/dereekb/dbx-components/commit/3ab16dff))
- added setContainsAllValues ([737c1e75](https://github.com/dereekb/dbx-components/commit/737c1e75))
- added dbxCoreAuthModule ([29ebf14b](https://github.com/dereekb/dbx-components/commit/29ebf14b))
- added modelConversionFunctions ([42050a8c](https://github.com/dereekb/dbx-components/commit/42050a8c))
- added snapshotConverter, firestoreField ([e986026a](https://github.com/dereekb/dbx-components/commit/e986026a))
- added firebase-server ([676cf9e6](https://github.com/dereekb/dbx-components/commit/676cf9e6))
- added transformAndValidateObject ([1f660941](https://github.com/dereekb/dbx-components/commit/1f660941))
- added onCallWithNestContext to firebase-server ([ad4fcf80](https://github.com/dereekb/dbx-components/commit/ad4fcf80))
- added isAllowed ([c2a70bf8](https://github.com/dereekb/dbx-components/commit/c2a70bf8))
- added dbxProgressButtons ([004ada21](https://github.com/dereekb/dbx-components/commit/004ada21))
- ⚠️  added dbxInjectionContext ([a6ac8010](https://github.com/dereekb/dbx-components/commit/a6ac8010))
- added firebase emulator data importing/exporting for persistence ([8739ba5b](https://github.com/dereekb/dbx-components/commit/8739ba5b))
- added dbxFirebaseLoginModule ([bf99f2d9](https://github.com/dereekb/dbx-components/commit/bf99f2d9))
- added dbxAppContextState ([dfc17ebf](https://github.com/dereekb/dbx-components/commit/dfc17ebf))
- added dbxAppContextStateModule, dbxAppAuthRouterModule ([40fa1fe9](https://github.com/dereekb/dbx-components/commit/40fa1fe9))
- dbxSelectionListViewContent can render as dbxListViewContent ([df162977](https://github.com/dereekb/dbx-components/commit/df162977))
- added cleanup() ([18854634](https://github.com/dereekb/dbx-components/commit/18854634))
- added dbxFirebaseModelLoaderModule ([15a8052e](https://github.com/dereekb/dbx-components/commit/15a8052e))
- added dbxListItemModifier, dbxListItemAnchorModifier ([a96ffa8e](https://github.com/dereekb/dbx-components/commit/a96ffa8e))
- ⚠️  added firebaseQueryItemAccumulator ([1e4e0f36](https://github.com/dereekb/dbx-components/commit/1e4e0f36))
- added dbxFirebaseCollectionStore ([9704c836](https://github.com/dereekb/dbx-components/commit/9704c836))
- added dbxFirebaseDocumentStore ([43da785b](https://github.com/dereekb/dbx-components/commit/43da785b))
- added dbxFirebaseCollectionWithParentStore ([b7045e76](https://github.com/dereekb/dbx-components/commit/b7045e76))
- added dbxFirebaseDocumentWithParentStore ([f055d81a](https://github.com/dereekb/dbx-components/commit/f055d81a))
- added dbxFirebaseFunctionsModule ([3d1bc695](https://github.com/dereekb/dbx-components/commit/3d1bc695))
- added modelTestContextFactory ([0a964425](https://github.com/dereekb/dbx-components/commit/0a964425))
- added modelConversionOptions to modelMapFunction ([2de30e07](https://github.com/dereekb/dbx-components/commit/2de30e07))
- added dbxListItemDisableRippleModifier ([c89cc82b](https://github.com/dereekb/dbx-components/commit/c89cc82b))
- added jestFunctionFixture ([1ea2d7d4](https://github.com/dereekb/dbx-components/commit/1ea2d7d4))
- firebaseServerAuthModule ([db9a4d3d](https://github.com/dereekb/dbx-components/commit/db9a4d3d))
- added AsyncPusher ([8cb20525](https://github.com/dereekb/dbx-components/commit/8cb20525))
- added dbxFormWorkingWrapperComponent ([fd32cd4c](https://github.com/dereekb/dbx-components/commit/fd32cd4c))
- refactored dbxFormSource ([aad115d9](https://github.com/dereekb/dbx-components/commit/aad115d9))
- added IterationQueryChangeWatcher ([f5b2474f](https://github.com/dereekb/dbx-components/commit/f5b2474f))
- added dbxFirebaseCollectionChangeDirective ([93a38a2b](https://github.com/dereekb/dbx-components/commit/93a38a2b))
- setup project ([fe2ae885](https://github.com/dereekb/dbx-components/commit/fe2ae885))
- added firebase functions v2 nest context components ([e5ca8925](https://github.com/dereekb/dbx-components/commit/e5ca8925))
- added handlerFunction ([7cd25174](https://github.com/dereekb/dbx-components/commit/7cd25174))
- added @dereekb/nestjs/stripe ([455f20e4](https://github.com/dereekb/dbx-components/commit/455f20e4))
- improved serve-server ([0e6fb186](https://github.com/dereekb/dbx-components/commit/0e6fb186))
- added nginx docker configuration for webhooks ([9425016e](https://github.com/dereekb/dbx-components/commit/9425016e))
- added catchAllHandlerKey to handler ([ab93b060](https://github.com/dereekb/dbx-components/commit/ab93b060))
- added clientAppService ([945f3882](https://github.com/dereekb/dbx-components/commit/945f3882))
- added functionsRegionOrCustomDomain configuration ([e27df0df](https://github.com/dereekb/dbx-components/commit/e27df0df))
- codedError now includes original error if available ([1262281f](https://github.com/dereekb/dbx-components/commit/1262281f))
- added firebase appCheck support to client ([e9377d16](https://github.com/dereekb/dbx-components/commit/e9377d16))
- added FirebaseAppCheckMiddleware ([25ddc4e7](https://github.com/dereekb/dbx-components/commit/25ddc4e7))
- added api proxying and rewrite configuration ([0117dae5](https://github.com/dereekb/dbx-components/commit/0117dae5))
- added dbxFirebaseAppCheckHttpInterceptor ([96fb5160](https://github.com/dereekb/dbx-components/commit/96fb5160))
- updated .env deployment to demo-api ([d88ea620](https://github.com/dereekb/dbx-components/commit/d88ea620))
- added firestore collection group support ([3b4c4cfa](https://github.com/dereekb/dbx-components/commit/3b4c4cfa))
- added collection group support to dbx-firebase components ([9f746c12](https://github.com/dereekb/dbx-components/commit/9f746c12))
- added authRolesObsWithClaimsService ([10055ae9](https://github.com/dereekb/dbx-components/commit/10055ae9))
- added grantedRoleMapReader ([11d2f178](https://github.com/dereekb/dbx-components/commit/11d2f178))
- added orderByDocumentId, startAtValue, endAtValue constraints ([c846feef](https://github.com/dereekb/dbx-components/commit/c846feef))
- added loadDocumentForKey to LimitedFirestoreDocumentAccessor ([96958b89](https://github.com/dereekb/dbx-components/commit/96958b89))
- added FirebaseModelsPermissionService ([9d75de40](https://github.com/dereekb/dbx-components/commit/9d75de40))
- added FirebaseModelService ([38765755](https://github.com/dereekb/dbx-components/commit/38765755))
- added firebaseModelsService ([7432e551](https://github.com/dereekb/dbx-components/commit/7432e551))
- added AbstractFirebaseNestContext ([2f8e1a21](https://github.com/dereekb/dbx-components/commit/2f8e1a21))
- ⚠️  added modelType to FirestoreDocument ([deecb5df](https://github.com/dereekb/dbx-components/commit/deecb5df))
- added InModelContextFirebaseModelServiceFactory ([9bf46973](https://github.com/dereekb/dbx-components/commit/9bf46973))
- added ContextGrantedModelRolesReader ([6fba1cc6](https://github.com/dereekb/dbx-components/commit/6fba1cc6))
- added OnCallUpdateModel ([3b60a06d](https://github.com/dereekb/dbx-components/commit/3b60a06d))
- added OnCallDeleteModel ([358189d6](https://github.com/dereekb/dbx-components/commit/358189d6))
- added onCallCreateModel ([84f7e72a](https://github.com/dereekb/dbx-components/commit/84f7e72a))
- added FirestoreDocumentStore crud functions ([7786a40f](https://github.com/dereekb/dbx-components/commit/7786a40f))
- added useModel to AbstractFirebaseNestContext ([29c19402](https://github.com/dereekb/dbx-components/commit/29c19402))
- added whereDocumentId() ([7f5f5b8a](https://github.com/dereekb/dbx-components/commit/7f5f5b8a))
- added loadDocumentForId() to FirestoreDocumentAccessor ([37281454](https://github.com/dereekb/dbx-components/commit/37281454))
- added firestoreArray ([e8522307](https://github.com/dereekb/dbx-components/commit/e8522307))
- added ModelModifier ([118bde78](https://github.com/dereekb/dbx-components/commit/118bde78))
- added interceptAccessorFactory() ([98335398](https://github.com/dereekb/dbx-components/commit/98335398))
- added firestoreEncodedArray, firestoreUniqueArray ([4f7fc7ca](https://github.com/dereekb/dbx-components/commit/4f7fc7ca))
- firestoreModeIdentity can now accept a collection name ([1e0646e5](https://github.com/dereekb/dbx-components/commit/1e0646e5))
- added function builders for object filters ([c01db204](https://github.com/dereekb/dbx-components/commit/c01db204))
- added additional KeyValueTypleValueFilter values ([715b6150](https://github.com/dereekb/dbx-components/commit/715b6150))
- added FirestoreMap, FirestoreArrayMap snapshot fields ([bd23fd37](https://github.com/dereekb/dbx-components/commit/bd23fd37))
- added overrideInObjectFunctionFactory, mergeObjectsFunction ([4ea7d656](https://github.com/dereekb/dbx-components/commit/4ea7d656))
- updated @ngx-formly to 6.0.0-beta.2 ([6f1737ab](https://github.com/dereekb/dbx-components/commit/6f1737ab))
- updated FirebaseServerAuthUserContext to be synchronous ([92bfd849](https://github.com/dereekb/dbx-components/commit/92bfd849))
- added ignore to AuthRoleClaimsFactoryConfig ([71e3caca](https://github.com/dereekb/dbx-components/commit/71e3caca))
- added grantModelRolesIfFunction and related types ([5432fab1](https://github.com/dereekb/dbx-components/commit/5432fab1))
- added UseFunction, MappedUseFunction ([84b6cbe2](https://github.com/dereekb/dbx-components/commit/84b6cbe2))
- added wrapUseFunction() ([7bbae2fd](https://github.com/dereekb/dbx-components/commit/7bbae2fd))
- added grantFullAccessIfAuthUserRelated() ([be05e093](https://github.com/dereekb/dbx-components/commit/be05e093))
- added UseAsync ([f52ff345](https://github.com/dereekb/dbx-components/commit/f52ff345))
- added useDocumentSnapshotData ([aa329f25](https://github.com/dereekb/dbx-components/commit/aa329f25))
- added firestoreEnum() ([28e67041](https://github.com/dereekb/dbx-components/commit/28e67041))
- added firestoreEnumArray() ([5f9e1b14](https://github.com/dereekb/dbx-components/commit/5f9e1b14))
- added performBatchLoop() ([7c6c9475](https://github.com/dereekb/dbx-components/commit/7c6c9475))
- added makeWithFactory() ([4a6f4a01](https://github.com/dereekb/dbx-components/commit/4a6f4a01))
- added arrayFactory() ([5a7ef131](https://github.com/dereekb/dbx-components/commit/5a7ef131))
- added idBatchFactory() ([b39510b7](https://github.com/dereekb/dbx-components/commit/b39510b7))
- added firestoreIdBatchVerifierFactory() ([182f086f](https://github.com/dereekb/dbx-components/commit/182f086f))
- added arrayToObject() ([edc723f9](https://github.com/dereekb/dbx-components/commit/edc723f9))
- added isAdminOrTargetUserInRequestData() ([c597eb9c](https://github.com/dereekb/dbx-components/commit/c597eb9c))
- updated firestoreModelKey() ([1459a150](https://github.com/dereekb/dbx-components/commit/1459a150))
- added describeCloudFunctionTest() to handle a map of functions ([55451495](https://github.com/dereekb/dbx-components/commit/55451495))
- added firestoreDocumentAccessor path validation ([775c66b9](https://github.com/dereekb/dbx-components/commit/775c66b9))
- added create to FirestoreDocumentDataAccessor ([92119754](https://github.com/dereekb/dbx-components/commit/92119754))
- added getWithConverter() ([aef4b27d](https://github.com/dereekb/dbx-components/commit/aef4b27d))
- added jest fail test utilities ([#13](https://github.com/dereekb/dbx-components/pull/13))
- added DbxRouteParamReader ([a8552835](https://github.com/dereekb/dbx-components/commit/a8552835))
- added DbxRouteParamDefaultInstance ([26085806](https://github.com/dereekb/dbx-components/commit/26085806))
- added getDocumentSnapshotsData() ([dc263409](https://github.com/dereekb/dbx-components/commit/dc263409))
- added DbxFirebaseDocumentLoaderInstance ([523d1dff](https://github.com/dereekb/dbx-components/commit/523d1dff))
- added valueSelectionField() ([2392a1b9](https://github.com/dereekb/dbx-components/commit/2392a1b9))
- added useAsObservable() ([a0e363d1](https://github.com/dereekb/dbx-components/commit/a0e363d1))
- added searchStringFilterFunction() ([f91aaafb](https://github.com/dereekb/dbx-components/commit/f91aaafb))
- added Observable to ValueSelectionFieldConfig ([235c2de9](https://github.com/dereekb/dbx-components/commit/235c2de9))
- added firestore key validators ([9d090db1](https://github.com/dereekb/dbx-components/commit/9d090db1))
- added DbxValueListGridViewComponent ([cca9a62d](https://github.com/dereekb/dbx-components/commit/cca9a62d))
- added number field ([387b0025](https://github.com/dereekb/dbx-components/commit/387b0025))
- added step, enforceStep to numberField ([a57b1c7f](https://github.com/dereekb/dbx-components/commit/a57b1c7f))
- added firestoreSubObjectField() ([3d6fbe17](https://github.com/dereekb/dbx-components/commit/3d6fbe17))
- added FirestoreObjectArray ([e1050eb5](https://github.com/dereekb/dbx-components/commit/e1050eb5))
- added firestoreLatLngString() ([2af3e5fc](https://github.com/dereekb/dbx-components/commit/2af3e5fc))
- added string functions ([1866db58](https://github.com/dereekb/dbx-components/commit/1866db58))
- added SlashPath ([8c902ab0](https://github.com/dereekb/dbx-components/commit/8c902ab0))
- added FirebaseStorageContext ([5a30d465](https://github.com/dereekb/dbx-components/commit/5a30d465))
- added firebase storage testing/mock components ([a2524b79](https://github.com/dereekb/dbx-components/commit/a2524b79))
- added firebaseStorageContextFactory ([e9405795](https://github.com/dereekb/dbx-components/commit/e9405795))
- added exists(), uploadStream(), getBytes(), getStream() ([e3fe97e5](https://github.com/dereekb/dbx-components/commit/e3fe97e5))
- added upload byte types, delete() ([655088b2](https://github.com/dereekb/dbx-components/commit/655088b2))
- added FirebaseServerStorageService ([38bf98aa](https://github.com/dereekb/dbx-components/commit/38bf98aa))
- added DbxFirebaseStorageService ([deeaa029](https://github.com/dereekb/dbx-components/commit/deeaa029))
- added list() and list exists() ([388c5935](https://github.com/dereekb/dbx-components/commit/388c5935))
- added specifier for crud functions ([39e366e0](https://github.com/dereekb/dbx-components/commit/39e366e0))
- added DateBlock ([b424dc09](https://github.com/dereekb/dbx-components/commit/b424dc09))
- added dbxCalendar ([88750cb4](https://github.com/dereekb/dbx-components/commit/88750cb4))
- added dbxCalendar Styling ([f9639863](https://github.com/dereekb/dbx-components/commit/f9639863))
- added sass extension configuration ([5b3b33ea](https://github.com/dereekb/dbx-components/commit/5b3b33ea))
- added DayOfWeek functions ([16b08bc8](https://github.com/dereekb/dbx-components/commit/16b08bc8))
- added WebsiteUrl and functions ([ed3430f7](https://github.com/dereekb/dbx-components/commit/ed3430f7))
- added DbxWidgetViewComponent ([6cf8d3a7](https://github.com/dereekb/dbx-components/commit/6cf8d3a7))
- added WebsiteLink ([68eda11f](https://github.com/dereekb/dbx-components/commit/68eda11f))
- added Firestore Increment support ([d4dc97b9](https://github.com/dereekb/dbx-components/commit/d4dc97b9))
- updated to angular 14 ([#15](https://github.com/dereekb/dbx-components/pull/15))
- added WebsiteFileLink ([dc58b5c3](https://github.com/dereekb/dbx-components/commit/dc58b5c3))
- added timezonePicker() ([a1b23c03](https://github.com/dereekb/dbx-components/commit/a1b23c03))
- added DbxFormMapboxLatLngFieldComponent ([5ce4fbb4](https://github.com/dereekb/dbx-components/commit/5ce4fbb4))
- added dbx-web-mapbox project ([5af3c3b8](https://github.com/dereekb/dbx-components/commit/5af3c3b8))
- added DbxMapboxMapStore ([9397b9a5](https://github.com/dereekb/dbx-components/commit/9397b9a5))
- added IsWithinLatLngBoundFunction() ([c986e5bf](https://github.com/dereekb/dbx-components/commit/c986e5bf))
- added Mapbox functions to DbxMapboxStore ([9a9f5f4a](https://github.com/dereekb/dbx-components/commit/9a9f5f4a))
- added dbx-map-layout ([49550205](https://github.com/dereekb/dbx-components/commit/49550205))
- added dbx-mapbox-menu ([8e310a7e](https://github.com/dereekb/dbx-components/commit/8e310a7e))
- added mapboxZoomField() ([9ab35748](https://github.com/dereekb/dbx-components/commit/9ab35748))
- added filterByMapboxViewportBound() ([a6beb56a](https://github.com/dereekb/dbx-components/commit/a6beb56a))
- added FirebaseServerNewUserService ([10d64dc1](https://github.com/dereekb/dbx-components/commit/10d64dc1))
- mailgun ([#16](https://github.com/dereekb/dbx-components/pull/16))
- added firebase scheduled tasks ([2114446a](https://github.com/dereekb/dbx-components/commit/2114446a))
- added firebaseServerDevFunctions() ([375e3acf](https://github.com/dereekb/dbx-components/commit/375e3acf))
- added DbxFirebaseDevelopmentModule ([f604882d](https://github.com/dereekb/dbx-components/commit/f604882d))
- added DbxFirebaseDevelopmentSchedulerService ([713bac57](https://github.com/dereekb/dbx-components/commit/713bac57))
- added DbxFirebaseDevelopmentSchedulerWidgetComponent ([99c57122](https://github.com/dereekb/dbx-components/commit/99c57122))
- added SystemStateDocument ([d4a0fcf5](https://github.com/dereekb/dbx-components/commit/d4a0fcf5))
- added @dereekb/util/fetch ([6afa4a48](https://github.com/dereekb/dbx-components/commit/6afa4a48))
- added OnCallReadModelFunction ([4c0eeb93](https://github.com/dereekb/dbx-components/commit/4c0eeb93))
- added firebaseDocumentStoreReadFunction() ([f2fd7eef](https://github.com/dereekb/dbx-components/commit/f2fd7eef))
- added redirectForUserIdentifierParamHook ([0f8467d9](https://github.com/dereekb/dbx-components/commit/0f8467d9))
- added DbxPresetMenuFilter ([2c08ad79](https://github.com/dereekb/dbx-components/commit/2c08ad79))
- added dbxListItemIsSelectedModifier ([7dea240f](https://github.com/dereekb/dbx-components/commit/7dea240f))
- added DbxItemListFieldComponent ([467a8799](https://github.com/dereekb/dbx-components/commit/467a8799))
- added duplicate button to repeatArrayField ([f4e027b9](https://github.com/dereekb/dbx-components/commit/f4e027b9))
- added DateScheduleDayCode ([0984e331](https://github.com/dereekb/dbx-components/commit/0984e331))
- added dateScheduleDateFilter() ([ab0e3810](https://github.com/dereekb/dbx-components/commit/ab0e3810))
- added IsDateWithinDateBlockRangeFunction ([994c6b1a](https://github.com/dereekb/dbx-components/commit/994c6b1a))
- added dateScheduleRangeField() ([#22](https://github.com/dereekb/dbx-components/pull/22))
- added DbxErrorWidgetService ([45cd525a](https://github.com/dereekb/dbx-components/commit/45cd525a))
- added DbxFirebaseModelTypesService ([d711abba](https://github.com/dereekb/dbx-components/commit/d711abba))
- dbx-table ([#23](https://github.com/dereekb/dbx-components/pull/23))
- added dbx-content-pit ([cbce68ad](https://github.com/dereekb/dbx-components/commit/cbce68ad))
- sourceselect field ([d0875f51](https://github.com/dereekb/dbx-components/commit/d0875f51))
- added DbxFirebaseModelHistoryPopoverButtonComponent ([ce8a720b](https://github.com/dereekb/dbx-components/commit/ce8a720b))
- added fixedDateRangeField() ([ff214ee0](https://github.com/dereekb/dbx-components/commit/ff214ee0))
- DateCellTiming ([#24](https://github.com/dereekb/dbx-components/pull/24))
- nx16 and Angular 16 migration ([#25](https://github.com/dereekb/dbx-components/pull/25))
- added dbxListTitleGroup for list views ([356b94b9](https://github.com/dereekb/dbx-components/commit/356b94b9))
- zoho recruit ([#26](https://github.com/dereekb/dbx-components/pull/26))
- notifications ([#27](https://github.com/dereekb/dbx-components/pull/27))
- angular 18 ([#28](https://github.com/dereekb/dbx-components/pull/28))
- zoom api ([#29](https://github.com/dereekb/dbx-components/pull/29))
- added vapi.ai integration ([c06f5e88](https://github.com/dereekb/dbx-components/commit/c06f5e88))
- notification tasks ([60e99591](https://github.com/dereekb/dbx-components/commit/60e99591))
- added @dereekb/nestjs/openai integration ([611724f3](https://github.com/dereekb/dbx-components/commit/611724f3))
- added NotificationExpediteService ([bdfc0b35](https://github.com/dereekb/dbx-components/commit/bdfc0b35))
- added StorageFile ([#30](https://github.com/dereekb/dbx-components/pull/30))
- added StorageFileGroup ([#31](https://github.com/dereekb/dbx-components/pull/31))
- zoho crm ([#32](https://github.com/dereekb/dbx-components/pull/32))
- ⚠️  dbx-components v13 ([#33](https://github.com/dereekb/dbx-components/pull/33))

### 🩹 Fixes

- dbx-web, dbx-form now export scss in package.json ([c7f7c148](https://github.com/dereekb/dbx-components/commit/c7f7c148))
- dbxDateTimeFieldComponent initial date fix ([1704052a](https://github.com/dereekb/dbx-components/commit/1704052a))
- updated force-start-release.sh ([3b4da487](https://github.com/dereekb/dbx-components/commit/3b4da487))
- firebase-tools dependency version bump ([2de00199](https://github.com/dereekb/dbx-components/commit/2de00199))
- fixed issue with allSuccessfulStates$ in itemAccumulatorInstance ([0396ac58](https://github.com/dereekb/dbx-components/commit/0396ac58))
- itemAccumulatorInstance fix ([d67c9d19](https://github.com/dereekb/dbx-components/commit/d67c9d19))
- cleanup() now calls the destroy function on complete ([dc8f06b7](https://github.com/dereekb/dbx-components/commit/dc8f06b7))
- fixed createOrUpdateWithAccessor ([243d0d3d](https://github.com/dereekb/dbx-components/commit/243d0d3d))
- fixed dbxFormlyForm async validation issue ([afb3f964](https://github.com/dereekb/dbx-components/commit/afb3f964))
- fixed package.json exports for util, firebase, and firebase-server ([04c1d9ab](https://github.com/dereekb/dbx-components/commit/04c1d9ab))
- setup-project fixes ([5e174fd9](https://github.com/dereekb/dbx-components/commit/5e174fd9))
- setup-project fixes ([d7003703](https://github.com/dereekb/dbx-components/commit/d7003703))
- added project context to all firebase cli calls ([9b7fd202](https://github.com/dereekb/dbx-components/commit/9b7fd202))
- setup-project proxy config path fix ([db6c9860](https://github.com/dereekb/dbx-components/commit/db6c9860))
- removed angular directives from abstractAsyncWindowLoadedService ([4ab7a740](https://github.com/dereekb/dbx-components/commit/4ab7a740))
- setup project template replacement fixes ([fbe36cf8](https://github.com/dereekb/dbx-components/commit/fbe36cf8))
- setup project scss fix ([9bfb6fde](https://github.com/dereekb/dbx-components/commit/9bfb6fde))
- isIterable and useIterableOrValue treat string as a value ([388d6f02](https://github.com/dereekb/dbx-components/commit/388d6f02))
- fixed dbxActionEnforceModifiedDirective ([f889b874](https://github.com/dereekb/dbx-components/commit/f889b874))
- hasAuthStateData interface fix ([8ea59e3c](https://github.com/dereekb/dbx-components/commit/8ea59e3c))
- hasAuthRoleHook fix ([e4749bae](https://github.com/dereekb/dbx-components/commit/e4749bae))
- added asIterable to handle strings ([9d5b7854](https://github.com/dereekb/dbx-components/commit/9d5b7854))
- util import path fixes ([e786b207](https://github.com/dereekb/dbx-components/commit/e786b207))
- versions bump ([3a1a6cf5](https://github.com/dereekb/dbx-components/commit/3a1a6cf5))
- locked nx version in setup-project ([25a30ed0](https://github.com/dereekb/dbx-components/commit/25a30ed0))
- fixed issue with example crud functions declaration ([8cb0aac5](https://github.com/dereekb/dbx-components/commit/8cb0aac5))
- updated GrantRolesOtherwiseFunction to allow returning Maybe ([552bb9c4](https://github.com/dereekb/dbx-components/commit/552bb9c4))
- fixed grantFullAccessIfAuthUserRelated typings ([f83af852](https://github.com/dereekb/dbx-components/commit/f83af852))
- documentAccessorForTransaction/WriteBatch now accepts a Maybe value ([beb17379](https://github.com/dereekb/dbx-components/commit/beb17379))
- grantFullAccessIfAuthUserRelated() now takes in a document or model ([53563dd9](https://github.com/dereekb/dbx-components/commit/53563dd9))
- import path fixes ([0b725584](https://github.com/dereekb/dbx-components/commit/0b725584))
- firestoreEnum test fix ([5996b79c](https://github.com/dereekb/dbx-components/commit/5996b79c))
- useAsync typings fixes with Maybe ([68f38a46](https://github.com/dereekb/dbx-components/commit/68f38a46))
- firestoreString now has a type specified ([ac7db1f5](https://github.com/dereekb/dbx-components/commit/ac7db1f5))
- added test-setup.ts config to setup-project.sh ([d374bf54](https://github.com/dereekb/dbx-components/commit/d374bf54))
- @nrwl/devkit version fix ([1818b79a](https://github.com/dereekb/dbx-components/commit/1818b79a))
- firebase dependency fix ([0ebd9b94](https://github.com/dereekb/dbx-components/commit/0ebd9b94))
- fixed util jest test declaration order ([3a05fb14](https://github.com/dereekb/dbx-components/commit/3a05fb14))
- fixed createTestFunctionContextOptions() authData typing ([ba017cd5](https://github.com/dereekb/dbx-components/commit/ba017cd5))
- fixed issue with permission.service.grant.ts declaration order ([b6074041](https://github.com/dereekb/dbx-components/commit/b6074041))
- fixed defaults of firestore-snapshot array fields ([8d388a9a](https://github.com/dereekb/dbx-components/commit/8d388a9a))
- fixed model conversions ([18ac25f8](https://github.com/dereekb/dbx-components/commit/18ac25f8))
- fixed documentRef not having converter configured ([308f3fa1](https://github.com/dereekb/dbx-components/commit/308f3fa1))
- fixed converter on loadDocument() ([1e680ac8](https://github.com/dereekb/dbx-components/commit/1e680ac8))
- fixed issue with snapshot falsy default values being ignored ([b433bc4a](https://github.com/dereekb/dbx-components/commit/b433bc4a))
- bump setup-project components version ([7c704765](https://github.com/dereekb/dbx-components/commit/7c704765))
- setup-project fix ([9406bfc0](https://github.com/dereekb/dbx-components/commit/9406bfc0))
- added dbxStyleBody to template root layout ([2897f90b](https://github.com/dereekb/dbx-components/commit/2897f90b))
- fixed function factory ([f722fb55](https://github.com/dereekb/dbx-components/commit/f722fb55))
- fixed AbstractDbxFirebaseDocumentStore key observables ([8f663a28](https://github.com/dereekb/dbx-components/commit/8f663a28))
- fixed validation messages ([b53656dd](https://github.com/dereekb/dbx-components/commit/b53656dd))
- fixed DbxTwoColumnSrefDirective input ([1df4eea0](https://github.com/dereekb/dbx-components/commit/1df4eea0))
- dbx-section-page fixes ([c23a9c40](https://github.com/dereekb/dbx-components/commit/c23a9c40))
- fixed filterKeyValueTupleFunction() keys filter ([dbf721fa](https://github.com/dereekb/dbx-components/commit/dbf721fa))
- added KeyAsString ([1337d42c](https://github.com/dereekb/dbx-components/commit/1337d42c))
- fixed DbxTwoColumnComponent styling ([77b4dd0e](https://github.com/dereekb/dbx-components/commit/77b4dd0e))
- wrapper props fix ([b002f398](https://github.com/dereekb/dbx-components/commit/b002f398))
- updated DbxFormlyFormComponent to poll for touched changes ([51670e4c](https://github.com/dereekb/dbx-components/commit/51670e4c))
- fixed AbstractSingleItemDbxFirebaseDocument constructor ([c2666036](https://github.com/dereekb/dbx-components/commit/c2666036))
- added pattern to textAreaField() ([de64fa74](https://github.com/dereekb/dbx-components/commit/de64fa74))
- fixed DbxFormRepeatArrayTypeComponent mark touched ([eb1dcea8](https://github.com/dereekb/dbx-components/commit/eb1dcea8))
- fixed LatLngStringRef ([88d9afe6](https://github.com/dereekb/dbx-components/commit/88d9afe6))
- added dependencies to setup-project.sh ([30c985d2](https://github.com/dereekb/dbx-components/commit/30c985d2))
- firebase storage test fix ([ff5c53ab](https://github.com/dereekb/dbx-components/commit/ff5c53ab))
- fixed slashPathType() ([180f2d64](https://github.com/dereekb/dbx-components/commit/180f2d64))
- fixed two column reverseSizing ([c2987764](https://github.com/dereekb/dbx-components/commit/c2987764))
- optionalFirestoreDate() ([58e170c9](https://github.com/dereekb/dbx-components/commit/58e170c9))
- setup-project string replace ([a72284f0](https://github.com/dereekb/dbx-components/commit/a72284f0))
- fixed AbstractSingleItemDbxFirebaseDocument setFirestoreCollection ([d0e83522](https://github.com/dereekb/dbx-components/commit/d0e83522))
- setup-project string replace ([fd7adf1a](https://github.com/dereekb/dbx-components/commit/fd7adf1a))
- firebase-server update fix ([38a52ca5](https://github.com/dereekb/dbx-components/commit/38a52ca5))
- fixed ModifyBeforeSetFirestoreDocumentDataAccessorWrapper ([68b5fff4](https://github.com/dereekb/dbx-components/commit/68b5fff4))
- fixed issue with AbstractFirestoreDocument stream$ ([3752d11f](https://github.com/dereekb/dbx-components/commit/3752d11f))
- fixed issue with ModelFirebaseCrudFunctionMapEntry for create ([a5ff2efe](https://github.com/dereekb/dbx-components/commit/a5ff2efe))
- fixed infinite loop in expandUniqueDateBlocks() ([7464f2d3](https://github.com/dereekb/dbx-components/commit/7464f2d3))
- fixed serve loop scripts ([b465b379](https://github.com/dereekb/dbx-components/commit/b465b379))
- fixed makeSingleItemFirestoreCollection ([4b8980de](https://github.com/dereekb/dbx-components/commit/4b8980de))
- fixed expandUniqueDateBlocksFunction() scenario ([2341c246](https://github.com/dereekb/dbx-components/commit/2341c246))
- fixed DbxMapboxMapDirective init issue ([789e3688](https://github.com/dereekb/dbx-components/commit/789e3688))
- fixed dbx-two-column-right styling ([501dc7e5](https://github.com/dereekb/dbx-components/commit/501dc7e5))
- dbx mapbox drawer style fix ([54fa8f21](https://github.com/dereekb/dbx-components/commit/54fa8f21))
- fixed dbx-mapbox-menu ([6c975fbc](https://github.com/dereekb/dbx-components/commit/6c975fbc))
- fixed issue where firebaseDocumentStoreUpdateFunction() repeated ([c5e76c5c](https://github.com/dereekb/dbx-components/commit/c5e76c5c))
- fixed isLatestSuccessfulRoute() initial value ([fbde9194](https://github.com/dereekb/dbx-components/commit/fbde9194))
- added error handling to DbxFirebaseAuthService authUserState ([206132f2](https://github.com/dereekb/dbx-components/commit/206132f2))
- fixed isLatLngPointWithinLatLngBound() ([d57c3693](https://github.com/dereekb/dbx-components/commit/d57c3693))
- fixed DbxFormMapboxLatLngFieldComponent input wrap ([0e4de7b6](https://github.com/dereekb/dbx-components/commit/0e4de7b6))
- fixed readKeysFunction array creation ([cab3ce70](https://github.com/dereekb/dbx-components/commit/cab3ce70))
- fixed zoom limits in DbxFormMapboxZoomFieldComponent ([a49e72ca](https://github.com/dereekb/dbx-components/commit/a49e72ca))
- fixed issue with easeTo input ([eb03604c](https://github.com/dereekb/dbx-components/commit/eb03604c))
- fixed dependencies for release ([7c57c7ef](https://github.com/dereekb/dbx-components/commit/7c57c7ef))
- fixed child package exports ([76fe1fac](https://github.com/dereekb/dbx-components/commit/76fe1fac))
- fixed primativeKeyStringDencoder() decoding ([427faf10](https://github.com/dereekb/dbx-components/commit/427faf10))
- onScheduleWithNestApplicationFactory fix ([3736e307](https://github.com/dereekb/dbx-components/commit/3736e307))
- dependency fix ([3445223b](https://github.com/dereekb/dbx-components/commit/3445223b))
- fixed scheduler cron issue ([8a960475](https://github.com/dereekb/dbx-components/commit/8a960475))
- fixed DbxPickableItemField selection ([1c980e69](https://github.com/dereekb/dbx-components/commit/1c980e69))
- fixed DbxFirebaseDevelopmentSchedulerService error handling ([3763fdf8](https://github.com/dereekb/dbx-components/commit/3763fdf8))
- fixed cronExpressionRepeatingEveryNMinutes ([63a7f8c4](https://github.com/dereekb/dbx-components/commit/63a7f8c4))
- assignValuesToPOJOFunction() now uses a copy by default ([e7f446da](https://github.com/dereekb/dbx-components/commit/e7f446da))
- added system files to setup ([22515466](https://github.com/dereekb/dbx-components/commit/22515466))
- fixed circular dependency import ([9b68403c](https://github.com/dereekb/dbx-components/commit/9b68403c))
- fixed dateBlockTiming() with 1 day distance ([53997068](https://github.com/dereekb/dbx-components/commit/53997068))
- adding missing exports ([b2c6b0db](https://github.com/dereekb/dbx-components/commit/b2c6b0db))
- fixed fetch issues ([8859b496](https://github.com/dereekb/dbx-components/commit/8859b496))
- fixed issue where empty queries were being appended to url ([2c787e83](https://github.com/dereekb/dbx-components/commit/2c787e83))
- fixed generateRandomSetupPassword() generating decimals ([a2d67a87](https://github.com/dereekb/dbx-components/commit/a2d67a87))
- fixed dbxActionConfirm input ([b31a350e](https://github.com/dereekb/dbx-components/commit/b31a350e))
- fixed styling with elevation in dbx-section ([c203ac8b](https://github.com/dereekb/dbx-components/commit/c203ac8b))
- fixed modelFirebaseFunctionMapFactory() short specifier ([ae28afef](https://github.com/dereekb/dbx-components/commit/ae28afef))
- fixed redirectForUserIdentifierParamHook() ([1be07a3e](https://github.com/dereekb/dbx-components/commit/1be07a3e))
- removed console print from DbxFirebaseEmulatorService ([8e5b6221](https://github.com/dereekb/dbx-components/commit/8e5b6221))
- dbx-section style fixes ([2bdaa888](https://github.com/dereekb/dbx-components/commit/2bdaa888))
- fixed dateTimeField input issue ([58232002](https://github.com/dereekb/dbx-components/commit/58232002))
- fixed dbxFormSourceObservable() emission ([cf927b43](https://github.com/dereekb/dbx-components/commit/cf927b43))
- fixed DbxFormSourceDirective always mode ([ed73d44d](https://github.com/dereekb/dbx-components/commit/ed73d44d))
- fixed nameField() not passing through expressions and config ([b6c9f76e](https://github.com/dereekb/dbx-components/commit/b6c9f76e))
- fixed toggleField() description position ([a0ac2039](https://github.com/dereekb/dbx-components/commit/a0ac2039))
- styling fix ([c883a2cc](https://github.com/dereekb/dbx-components/commit/c883a2cc))
- added handleFetchJsonParseErrorFunction config ([71c16810](https://github.com/dereekb/dbx-components/commit/71c16810))
- fixed typing issues ([f59cecf5](https://github.com/dereekb/dbx-components/commit/f59cecf5))
- updated types for @Export() types due to jest issue ([24b2b65b](https://github.com/dereekb/dbx-components/commit/24b2b65b))
- fixed dbx-button icons styling ([f0b2b9f0](https://github.com/dereekb/dbx-components/commit/f0b2b9f0))
- fixed typescript import issue introduced in 4.7 ([168c8b96](https://github.com/dereekb/dbx-components/commit/168c8b96))
- restored missing calendars views ([e6146458](https://github.com/dereekb/dbx-components/commit/e6146458))
- fixed issue in mergeLoadingStates() ([4206396d](https://github.com/dereekb/dbx-components/commit/4206396d))
- fixed dbx-section-page-content height ([5f54f83b](https://github.com/dereekb/dbx-components/commit/5f54f83b))
- fixed mapbox fields marked issue ([04e6e3a5](https://github.com/dereekb/dbx-components/commit/04e6e3a5))
- fixed DateBlockTiming class-validator validation/parsing ([23596cba](https://github.com/dereekb/dbx-components/commit/23596cba))
- fixed convertHttpsCallableErrorToReadableError() ([78decc85](https://github.com/dereekb/dbx-components/commit/78decc85))
- fixed issue with transactions in firestoreCollectionQueryFactory ([79a14563](https://github.com/dereekb/dbx-components/commit/79a14563))
- fixed converter issue ([de8874d4](https://github.com/dereekb/dbx-components/commit/de8874d4))
- beginResetPassword() now sets the password properly ([7137ed7d](https://github.com/dereekb/dbx-components/commit/7137ed7d))
- fixed beginResetPassword() ([5341f5cc](https://github.com/dereekb/dbx-components/commit/5341f5cc))
- fixed beginResetPassword() ([fdce1b8d](https://github.com/dereekb/dbx-components/commit/fdce1b8d))
- analytics fixes ([f21e0d60](https://github.com/dereekb/dbx-components/commit/f21e0d60))
- fixed convertMailgunTemplateEmailRequestToMailgunMessageData() ([e378c74a](https://github.com/dereekb/dbx-components/commit/e378c74a))
- fixed enableMultiTabIndexedDbPersistence usage ([2c41552c](https://github.com/dereekb/dbx-components/commit/2c41552c))
- fixed loadDocumentsForIdsFromValues() ([424f02f3](https://github.com/dereekb/dbx-components/commit/424f02f3))
- fixed ClickableFilterPreset type ([5bab6db5](https://github.com/dereekb/dbx-components/commit/5bab6db5))
- fixed AbstractDbxPresetFilterMenuComponent usage of getters ([b1540846](https://github.com/dereekb/dbx-components/commit/b1540846))
- fixed styling ([1e409fad](https://github.com/dereekb/dbx-components/commit/1e409fad))
- added daylight savings handling for isValidDateBlockTiming() ([1955016c](https://github.com/dereekb/dbx-components/commit/1955016c))
- fixed booleanFactory() chance calculation ([a2443416](https://github.com/dereekb/dbx-components/commit/a2443416))
- dbx-mapbox-marker icon content fix ([0b6165f5](https://github.com/dereekb/dbx-components/commit/0b6165f5))
- removed async from hasNewUserSetupPasswordInRequest() ([5c7bf2ea](https://github.com/dereekb/dbx-components/commit/5c7bf2ea))
- fixed modifyDateBlocksToFitRange() to fit to 0-0 range ([48031329](https://github.com/dereekb/dbx-components/commit/48031329))
- fixed getClosingValueFn usage in DbxPopoverComponent ([b9d3e3eb](https://github.com/dereekb/dbx-components/commit/b9d3e3eb))
- fixed calendar schedule filter output value ([c9b6021b](https://github.com/dereekb/dbx-components/commit/c9b6021b))
- fixed dateScheduleDateFilter() not handling a 0-0 range properly ([bb33a362](https://github.com/dereekb/dbx-components/commit/bb33a362))
- fixed DbxPartialPresetFilterMenuComponent generic ([11e099c7](https://github.com/dereekb/dbx-components/commit/11e099c7))
- style fix for mapbox marker css classes ([2abddd19](https://github.com/dereekb/dbx-components/commit/2abddd19))
- fixed improper behavior with asGetter()/getValueFromGetter() ([d2570e9a](https://github.com/dereekb/dbx-components/commit/d2570e9a))
- fixed markerClasses usage in DbxMapboxMarkerComponent ([d0a0b183](https://github.com/dereekb/dbx-components/commit/d0a0b183))
- calendar selection store min/max range with filter fix ([865ef18d](https://github.com/dereekb/dbx-components/commit/865ef18d))
- fixed calendar selection end being before start when using a filter ([25f905f6](https://github.com/dereekb/dbx-components/commit/25f905f6))
- fixed timezones changing for dateTimeField() ([b1d391d7](https://github.com/dereekb/dbx-components/commit/b1d391d7))
- fixed timezones with dateScheduleRangeField() ([421f64c5](https://github.com/dereekb/dbx-components/commit/421f64c5))
- fixed isValidDateBlockIndex() ([0cdf4f87](https://github.com/dereekb/dbx-components/commit/0cdf4f87))
- fixed LimitDateTimeInstance min value ([dc0c1b7c](https://github.com/dereekb/dbx-components/commit/dc0c1b7c))
- fixed expandDateScheduleRange, dateBlockTimingForDateScheduleRange ([b758918c](https://github.com/dereekb/dbx-components/commit/b758918c))
- fixed dateBlockTimingInTimezoneFunction() ([6d1bd8ab](https://github.com/dereekb/dbx-components/commit/6d1bd8ab))
- fixed dateScheduleDateFilter() timezone usage ([85bf0219](https://github.com/dereekb/dbx-components/commit/85bf0219))
- fixed yearWeekCodeDateFactory() timezone issue ([c4a8514c](https://github.com/dereekb/dbx-components/commit/c4a8514c))
- fixed DbxCalendarScheduleSelectionStore ([14014af4](https://github.com/dereekb/dbx-components/commit/14014af4))
- fixed issue with min/max range in DbxCalendarScheduleSelectionStore ([871fc204](https://github.com/dereekb/dbx-components/commit/871fc204))
- fixed value selection field single value selection parser ([33f64cbe](https://github.com/dereekb/dbx-components/commit/33f64cbe))
- fix unintentional deprecated variable renaming ([5f28f51e](https://github.com/dereekb/dbx-components/commit/5f28f51e))
- fixed dateTimeField() timeOnly mode not emitting value ([4f3548ba](https://github.com/dereekb/dbx-components/commit/4f3548ba))

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
- added modelType to FirestoreDocument  ([deecb5df](https://github.com/dereekb/dbx-components/commit/deecb5df))
  model type is now required on FirestoreDocument models
- added firebaseQueryItemAccumulator  ([1e4e0f36](https://github.com/dereekb/dbx-components/commit/1e4e0f36))
  - renamed flattenIterationResultItemArray to flattenAccumulatorResultItemArray since the input is an accumulator and not an iteration
- added dbxInjectionContext  ([a6ac8010](https://github.com/dereekb/dbx-components/commit/a6ac8010))
  renamed dbxInjectedContent to dbxInjection, renamed related content

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


### Features

* added NotificationExpediteService ([bdfc0b3](https://github.com/dereekb/dbx-components/commit/bdfc0b35f11d3f60f0daa5fd4522f31da593f7d7))



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


### Features

* added @dereekb/nestjs/openai integration ([611724f](https://github.com/dereekb/dbx-components/commit/611724f3c5354f2c38a6aecf75a64085f2aa6bcd))
* notification tasks ([60e9959](https://github.com/dereekb/dbx-components/commit/60e995919b14d3262191cbeedc26a169c179ff24))



## [12.2.1](https://github.com/dereekb/dbx-components/compare/v12.2.0-dev...v12.2.1) (2025-07-02)



# [12.2.0](https://github.com/dereekb/dbx-components/compare/v12.1.14-dev...v12.2.0) (2025-06-29)


### Features

* added vapi.ai integration ([c06f5e8](https://github.com/dereekb/dbx-components/commit/c06f5e886369ad5da2712b667346b5cbf7161845))



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


### Build System

* setup project ([a7f7755](https://github.com/dereekb/dbx-components/commit/a7f77557166b9d4d1bff658e0d5504ff61eb1539))


### Features

* angular 18 ([#28](https://github.com/dereekb/dbx-components/issues/28)) ([c8f5472](https://github.com/dereekb/dbx-components/commit/c8f5472026b47c8877f404a9c87bf7a3fa68b45b))


### BREAKING CHANGES

* Angular 18 and Nx 20 major version



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


### Features

* zoho recruit ([#26](https://github.com/dereekb/dbx-components/issues/26)) ([8e028fd](https://github.com/dereekb/dbx-components/commit/8e028fd6fc57fb276ce04d37ce010fb5a42d4157))



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


### Bug Fixes

* fixed dateTimeField() timeOnly mode not emitting value ([4f3548b](https://github.com/dereekb/dbx-components/commit/4f3548ba9af137cbbfa5bc1a219f5a12bf661abf))



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


### Features

* added dbxListTitleGroup for list views ([356b94b](https://github.com/dereekb/dbx-components/commit/356b94b963ef290820915c25562323b27b3449b1))



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


### Bug Fixes

* fixed value selection field single value selection parser ([33f64cb](https://github.com/dereekb/dbx-components/commit/33f64cbe3f22a2d9b7f6e4e939b956264aed34a0))



## [9.25.10](https://github.com/dereekb/dbx-components/compare/v9.25.9-dev...v9.25.10) (2023-11-01)



## [9.25.9](https://github.com/dereekb/dbx-components/compare/v9.25.8-dev...v9.25.9) (2023-10-31)



## [9.25.8](https://github.com/dereekb/dbx-components/compare/v9.25.7-dev...v9.25.8) (2023-10-31)



## [9.25.7](https://github.com/dereekb/dbx-components/compare/v9.25.6-dev...v9.25.7) (2023-10-26)



## [9.25.6](https://github.com/dereekb/dbx-components/compare/v9.25.5-dev...v9.25.6) (2023-10-17)


### Bug Fixes

* fixed issue with min/max range in DbxCalendarScheduleSelectionStore ([871fc20](https://github.com/dereekb/dbx-components/commit/871fc2041b98c86c4da03eac6e2a6aaa84c54f70))



## [9.25.5](https://github.com/dereekb/dbx-components/compare/v9.25.4-dev...v9.25.5) (2023-10-16)



## [9.25.4](https://github.com/dereekb/dbx-components/compare/v9.25.3-dev...v9.25.4) (2023-10-16)



## [9.25.3](https://github.com/dereekb/dbx-components/compare/v9.25.2-dev...v9.25.3) (2023-10-15)


### Bug Fixes

* fixed DbxCalendarScheduleSelectionStore ([14014af](https://github.com/dereekb/dbx-components/commit/14014af43034173a4dc09d983a88b9228182a88b))



## [9.25.2](https://github.com/dereekb/dbx-components/compare/v9.25.1-dev...v9.25.2) (2023-10-14)


### Bug Fixes

* fixed yearWeekCodeDateFactory() timezone issue ([c4a8514](https://github.com/dereekb/dbx-components/commit/c4a8514c60414e7448f27ff4b5146508ac7baa0f))



## [9.25.1](https://github.com/dereekb/dbx-components/compare/v9.25.0-dev...v9.25.1) (2023-10-13)



# [9.25.0](https://github.com/dereekb/dbx-components/compare/v9.24.47-dev...v9.25.0) (2023-10-10)


### Features

* DateCellTiming ([#24](https://github.com/dereekb/dbx-components/issues/24)) ([aed9ef5](https://github.com/dereekb/dbx-components/commit/aed9ef56fdd0438a7a4ba90da79d6a20465bbdfd))



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


### Bug Fixes

* fixed dateScheduleDateFilter() timezone usage ([85bf021](https://github.com/dereekb/dbx-components/commit/85bf0219d92e9806657df3cf2c1ad0f58504c138))



## [9.24.23](https://github.com/dereekb/dbx-components/compare/v9.24.22-dev...v9.24.23) (2023-08-05)


### Bug Fixes

* fixed dateBlockTimingInTimezoneFunction() ([6d1bd8a](https://github.com/dereekb/dbx-components/commit/6d1bd8abb3f79a4407c0bb4f62fa6e3e4c4a9604))
* fixed expandDateScheduleRange, dateBlockTimingForDateScheduleRange ([b758918](https://github.com/dereekb/dbx-components/commit/b758918c140011392ceb69e42a78e40b2f55cc35))



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


### Bug Fixes

* fixed LimitDateTimeInstance min value ([dc0c1b7](https://github.com/dereekb/dbx-components/commit/dc0c1b7ce7977803d327ae9edbe76e3a7701ba36))



# [9.24.0](https://github.com/dereekb/dbx-components/compare/v9.23.28-dev...v9.24.0) (2023-06-15)


### Features

* added fixedDateRangeField() ([ff214ee](https://github.com/dereekb/dbx-components/commit/ff214ee066c524fb0a6f5b1638ecbffdee53e985))



## [9.23.28](https://github.com/dereekb/dbx-components/compare/v9.23.27-dev...v9.23.28) (2023-06-08)



## [9.23.27](https://github.com/dereekb/dbx-components/compare/v9.23.26-dev...v9.23.27) (2023-06-06)



## [9.23.26](https://github.com/dereekb/dbx-components/compare/v9.23.25-dev...v9.23.26) (2023-06-05)



## [9.23.25](https://github.com/dereekb/dbx-components/compare/v9.23.24-dev...v9.23.25) (2023-05-31)


### Bug Fixes

* fixed isValidDateBlockIndex() ([0cdf4f8](https://github.com/dereekb/dbx-components/commit/0cdf4f8734a827ad77ab308512eacce61997c699))



## [9.23.24](https://github.com/dereekb/dbx-components/compare/v9.23.23-dev...v9.23.24) (2023-05-30)


### Bug Fixes

* fixed timezones with dateScheduleRangeField() ([421f64c](https://github.com/dereekb/dbx-components/commit/421f64c5cf0c90d3076371450bc05d292d85d7db))



## [9.23.23](https://github.com/dereekb/dbx-components/compare/v9.23.22-dev...v9.23.23) (2023-05-30)



## [9.23.22](https://github.com/dereekb/dbx-components/compare/v9.23.21-dev...v9.23.22) (2023-05-29)


### Bug Fixes

* fixed timezones changing for dateTimeField() ([b1d391d](https://github.com/dereekb/dbx-components/commit/b1d391d7f3ee3deb82fd32aa141d7ebf08349bf6))



## [9.23.21](https://github.com/dereekb/dbx-components/compare/v9.23.20-dev...v9.23.21) (2023-05-27)



## [9.23.20](https://github.com/dereekb/dbx-components/compare/v9.23.19-dev...v9.23.20) (2023-05-19)


### Bug Fixes

* calendar selection store min/max range with filter fix ([865ef18](https://github.com/dereekb/dbx-components/commit/865ef18d2456a6be4f040c485196a3d6eef2386b))
* fixed calendar selection end being before start when using a filter ([25f905f](https://github.com/dereekb/dbx-components/commit/25f905f6da092e4b2fbc42fdacd2dfb9d9c7eff1))
* fixed markerClasses usage in DbxMapboxMarkerComponent ([d0a0b18](https://github.com/dereekb/dbx-components/commit/d0a0b1832cfc621627f0ca60f91251fea6f0aa92))



## [9.23.19](https://github.com/dereekb/dbx-components/compare/v9.23.18-dev...v9.23.19) (2023-05-11)



## [9.23.18](https://github.com/dereekb/dbx-components/compare/v9.23.17-dev...v9.23.18) (2023-05-10)


### Bug Fixes

* fixed improper behavior with asGetter()/getValueFromGetter() ([d2570e9](https://github.com/dereekb/dbx-components/commit/d2570e9acb70d824e744d38657167a49f8ddc65f))
* style fix for mapbox marker css classes ([2abddd1](https://github.com/dereekb/dbx-components/commit/2abddd192854f9a2a256514cfc9dc42d0bcbcdc3))



## [9.23.17](https://github.com/dereekb/dbx-components/compare/v9.23.16-dev...v9.23.17) (2023-05-04)



## [9.23.16](https://github.com/dereekb/dbx-components/compare/v9.23.15-dev...v9.23.16) (2023-05-02)


### Bug Fixes

* fixed DbxPartialPresetFilterMenuComponent generic ([11e099c](https://github.com/dereekb/dbx-components/commit/11e099c72cad1bce6359757f7e4d613e2ae1f8fe))



## [9.23.15](https://github.com/dereekb/dbx-components/compare/v9.23.14-dev...v9.23.15) (2023-05-01)



## [9.23.14](https://github.com/dereekb/dbx-components/compare/v9.23.13-dev...v9.23.14) (2023-04-30)


### Bug Fixes

* fixed dateScheduleDateFilter() not handling a 0-0 range properly ([bb33a36](https://github.com/dereekb/dbx-components/commit/bb33a362ebe03bcfa55c2277c7f0faae05ba34b2))



## [9.23.13](https://github.com/dereekb/dbx-components/compare/v9.23.12-dev...v9.23.13) (2023-04-25)



## [9.23.12](https://github.com/dereekb/dbx-components/compare/v9.23.11-dev...v9.23.12) (2023-04-23)


### Bug Fixes

* fixed calendar schedule filter output value ([c9b6021](https://github.com/dereekb/dbx-components/commit/c9b6021b797a5298e56a2ad5dbee071d96a19bce))
* fixed getClosingValueFn usage in DbxPopoverComponent ([b9d3e3e](https://github.com/dereekb/dbx-components/commit/b9d3e3eba83404b8add5e68d25df92a79ba99cc9))



## [9.23.11](https://github.com/dereekb/dbx-components/compare/v9.23.10-dev...v9.23.11) (2023-04-21)



## [9.23.10](https://github.com/dereekb/dbx-components/compare/v9.23.9-dev...v9.23.10) (2023-04-20)


### Bug Fixes

* fixed modifyDateBlocksToFitRange() to fit to 0-0 range ([4803132](https://github.com/dereekb/dbx-components/commit/4803132951c34a8661425d2d4d7a89fc9b86e476))



## [9.23.9](https://github.com/dereekb/dbx-components/compare/v9.23.8-dev...v9.23.9) (2023-04-13)



## [9.23.8](https://github.com/dereekb/dbx-components/compare/v9.23.7-dev...v9.23.8) (2023-04-12)



## [9.23.7](https://github.com/dereekb/dbx-components/compare/v9.23.6-dev...v9.23.7) (2023-04-10)



## [9.23.6](https://github.com/dereekb/dbx-components/compare/v9.23.5-dev...v9.23.6) (2023-04-09)


### Bug Fixes

* removed async from hasNewUserSetupPasswordInRequest() ([5c7bf2e](https://github.com/dereekb/dbx-components/commit/5c7bf2eafeed05d2e2d7f873af4ca3f38fe1efd0))



## [9.23.5](https://github.com/dereekb/dbx-components/compare/v9.23.4-dev...v9.23.5) (2023-04-04)


### Bug Fixes

* dbx-mapbox-marker icon content fix ([0b6165f](https://github.com/dereekb/dbx-components/commit/0b6165f552096498159e4643a1ddc47743ef4b79))



## [9.23.4](https://github.com/dereekb/dbx-components/compare/v9.23.3-dev...v9.23.4) (2023-04-01)


### Bug Fixes

* fixed booleanFactory() chance calculation ([a244341](https://github.com/dereekb/dbx-components/commit/a24434163e6a9ea9cb9d6764b3026c0eddb978eb))



## [9.23.3](https://github.com/dereekb/dbx-components/compare/v9.23.2-dev...v9.23.3) (2023-03-30)



## [9.23.2](https://github.com/dereekb/dbx-components/compare/v9.23.1-dev...v9.23.2) (2023-03-30)



## [9.23.1](https://github.com/dereekb/dbx-components/compare/v9.23.0-dev...v9.23.1) (2023-03-30)



# [9.23.0](https://github.com/dereekb/dbx-components/compare/v9.22.11-dev...v9.23.0) (2023-03-28)


### Features

* added DbxFirebaseModelHistoryPopoverButtonComponent ([ce8a720](https://github.com/dereekb/dbx-components/commit/ce8a720bb600814e8ae695c8067323545d60de25))



## [9.22.11](https://github.com/dereekb/dbx-components/compare/v9.22.10-dev...v9.22.11) (2023-03-26)



## [9.22.10](https://github.com/dereekb/dbx-components/compare/v9.22.9-dev...v9.22.10) (2023-03-22)



## [9.22.9](https://github.com/dereekb/dbx-components/compare/v9.22.8-dev...v9.22.9) (2023-03-21)



## [9.22.8](https://github.com/dereekb/dbx-components/compare/v9.22.7-dev...v9.22.8) (2023-03-06)


### Bug Fixes

* added daylight savings handling for isValidDateBlockTiming() ([1955016](https://github.com/dereekb/dbx-components/commit/1955016cb715934d0b86246dbee3b754bb7e9cfd))



## [9.22.7](https://github.com/dereekb/dbx-components/compare/v9.22.6-dev...v9.22.7) (2023-03-03)


### Bug Fixes

* fixed styling ([1e409fa](https://github.com/dereekb/dbx-components/commit/1e409fad90cf6a14b97acb31fd84bddf46206242))



## [9.22.6](https://github.com/dereekb/dbx-components/compare/v9.22.5-dev...v9.22.6) (2023-03-02)



## [9.22.5](https://github.com/dereekb/dbx-components/compare/v9.22.4-dev...v9.22.5) (2023-02-28)



## [9.22.4](https://github.com/dereekb/dbx-components/compare/v9.22.3-dev...v9.22.4) (2023-02-27)


### Bug Fixes

* fixed AbstractDbxPresetFilterMenuComponent usage of getters ([b154084](https://github.com/dereekb/dbx-components/commit/b154084650df01ee36cc011819e73bbac5d855ba))
* fixed ClickableFilterPreset type ([5bab6db](https://github.com/dereekb/dbx-components/commit/5bab6db5f5bf97a373ef6f057effb6bfc28310d5))



## [9.22.3](https://github.com/dereekb/dbx-components/compare/v9.22.2-dev...v9.22.3) (2023-02-27)



## [9.22.2](https://github.com/dereekb/dbx-components/compare/v9.22.1-dev...v9.22.2) (2023-02-25)



## [9.22.1](https://github.com/dereekb/dbx-components/compare/v9.22.0-dev...v9.22.1) (2023-02-24)


### Bug Fixes

* fixed loadDocumentsForIdsFromValues() ([424f02f](https://github.com/dereekb/dbx-components/commit/424f02f31bd1fce8f7b0c15e55ca47434f83ee90))



# [9.22.0](https://github.com/dereekb/dbx-components/compare/v9.21.0-dev...v9.22.0) (2023-02-20)


### Features

* sourceselect field ([d0875f5](https://github.com/dereekb/dbx-components/commit/d0875f5188161aec0f669a1bfed0ebe227d0d69a))



# [9.21.0](https://github.com/dereekb/dbx-components/compare/v9.20.20-dev...v9.21.0) (2023-01-31)


### Bug Fixes

* fixed enableMultiTabIndexedDbPersistence usage ([2c41552](https://github.com/dereekb/dbx-components/commit/2c41552c6849cd7cae2405cd456d92bca265a5d3))


### Features

* added dbx-content-pit ([cbce68a](https://github.com/dereekb/dbx-components/commit/cbce68ad73dc896acc34232e3375698133e99241))
* dbx-table ([#23](https://github.com/dereekb/dbx-components/issues/23)) ([4661508](https://github.com/dereekb/dbx-components/commit/466150895b5bdc6e9e5289ef38ef5dd3e0ae67f9))



## [9.20.20](https://github.com/dereekb/dbx-components/compare/v9.20.19-dev...v9.20.20) (2023-01-23)



## [9.20.19](https://github.com/dereekb/dbx-components/compare/v9.20.18-dev...v9.20.19) (2023-01-17)



## [9.20.18](https://github.com/dereekb/dbx-components/compare/v9.20.17-dev...v9.20.18) (2023-01-08)



## [9.20.17](https://github.com/dereekb/dbx-components/compare/v9.20.16-dev...v9.20.17) (2023-01-05)


### Bug Fixes

* fixed convertMailgunTemplateEmailRequestToMailgunMessageData() ([e378c74](https://github.com/dereekb/dbx-components/commit/e378c74a28aadd674ff3749787aceed8a9ba6ab6))



## [9.20.16](https://github.com/dereekb/dbx-components/compare/v9.20.15-dev...v9.20.16) (2023-01-05)


### Bug Fixes

* analytics fixes ([f21e0d6](https://github.com/dereekb/dbx-components/commit/f21e0d600b0a7d08de6a257fc10645fcd5cc0264))



## [9.20.15](https://github.com/dereekb/dbx-components/compare/v9.20.14-dev...v9.20.15) (2023-01-05)


### Bug Fixes

* fixed beginResetPassword() ([fdce1b8](https://github.com/dereekb/dbx-components/commit/fdce1b8d583f4533f1d4ba4c7c7092c505bf1705))



## [9.20.14](https://github.com/dereekb/dbx-components/compare/v9.20.13-dev...v9.20.14) (2023-01-04)


### Bug Fixes

* fixed beginResetPassword() ([5341f5c](https://github.com/dereekb/dbx-components/commit/5341f5cc6293cfe6cafdc14d4d4d2eebe9375f6b))



## [9.20.13](https://github.com/dereekb/dbx-components/compare/v9.20.12-dev...v9.20.13) (2023-01-04)



## [9.20.12](https://github.com/dereekb/dbx-components/compare/v9.20.11-dev...v9.20.12) (2023-01-04)


### Bug Fixes

* beginResetPassword() now sets the password properly ([7137ed7](https://github.com/dereekb/dbx-components/commit/7137ed7df48e35fbd9bdb7c920043aa4d634b507))



## [9.20.11](https://github.com/dereekb/dbx-components/compare/v9.20.10-dev...v9.20.11) (2023-01-03)



## [9.20.10](https://github.com/dereekb/dbx-components/compare/v9.20.9-dev...v9.20.10) (2023-01-03)



## [9.20.9](https://github.com/dereekb/dbx-components/compare/v9.20.8-dev...v9.20.9) (2023-01-01)



## [9.20.8](https://github.com/dereekb/dbx-components/compare/v9.20.7-dev...v9.20.8) (2022-12-31)


### Bug Fixes

* fixed converter issue ([de8874d](https://github.com/dereekb/dbx-components/commit/de8874d4318ba4a0f2debadcfd0eb5acc29bc451))



## [9.20.7](https://github.com/dereekb/dbx-components/compare/v9.20.6-dev...v9.20.7) (2022-12-31)



## [9.20.6](https://github.com/dereekb/dbx-components/compare/v9.20.5-dev...v9.20.6) (2022-12-26)



## [9.20.5](https://github.com/dereekb/dbx-components/compare/v9.20.4-dev...v9.20.5) (2022-12-26)



## [9.20.4](https://github.com/dereekb/dbx-components/compare/v9.20.3-dev...v9.20.4) (2022-12-24)


### Bug Fixes

* fixed issue with transactions in firestoreCollectionQueryFactory ([79a1456](https://github.com/dereekb/dbx-components/commit/79a1456336df8b9cce1755a40f704c8d8591d064))



## [9.20.3](https://github.com/dereekb/dbx-components/compare/v9.20.2-dev...v9.20.3) (2022-12-22)


### Bug Fixes

* fixed convertHttpsCallableErrorToReadableError() ([78decc8](https://github.com/dereekb/dbx-components/commit/78decc857912ac1b259e59fdf9ade7e6976af8c9))



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


### Bug Fixes

* fixed DateBlockTiming class-validator validation/parsing ([23596cb](https://github.com/dereekb/dbx-components/commit/23596cba31818f16891e8105fa9f371a27b5ffd9))



# [9.19.0](https://github.com/dereekb/dbx-components/compare/v9.18.6-dev...v9.19.0) (2022-12-11)


### Features

* added DbxErrorWidgetService ([45cd525](https://github.com/dereekb/dbx-components/commit/45cd525ac45f0337d50c9d6d91f27f4429d63bdf))



## [9.18.6](https://github.com/dereekb/dbx-components/compare/v9.18.5-dev...v9.18.6) (2022-12-10)



## [9.18.5](https://github.com/dereekb/dbx-components/compare/v9.18.4-dev...v9.18.5) (2022-12-10)


### Bug Fixes

* fixed dbx-section-page-content height ([5f54f83](https://github.com/dereekb/dbx-components/commit/5f54f83b9eb4d8aa383a2d4d88e758e9b19422a5))
* fixed mapbox fields marked issue ([04e6e3a](https://github.com/dereekb/dbx-components/commit/04e6e3a50ff02580264e802e320072155830eea2))



## [9.18.4](https://github.com/dereekb/dbx-components/compare/v9.18.3-dev...v9.18.4) (2022-12-09)



## [9.18.3](https://github.com/dereekb/dbx-components/compare/v9.18.2-dev...v9.18.3) (2022-12-09)


### Bug Fixes

* fixed issue in mergeLoadingStates() ([4206396](https://github.com/dereekb/dbx-components/commit/4206396df9524bea79ba3b80d107aec7eb64a20a))



## [9.18.2](https://github.com/dereekb/dbx-components/compare/v9.18.1-dev...v9.18.2) (2022-12-08)


### Bug Fixes

* restored missing calendars views ([e614645](https://github.com/dereekb/dbx-components/commit/e6146458e5badd09c5b3e75c727802fe41015462))



## [9.18.1](https://github.com/dereekb/dbx-components/compare/v9.18.0-dev...v9.18.1) (2022-12-07)



# [9.18.0](https://github.com/dereekb/dbx-components/compare/v9.17.3-dev...v9.18.0) (2022-12-07)


### Bug Fixes

* fixed dbx-button icons styling ([f0b2b9f](https://github.com/dereekb/dbx-components/commit/f0b2b9f08d972f9dbd1d932fe515a2f5ab998376))
* fixed typescript import issue introduced in 4.7 ([168c8b9](https://github.com/dereekb/dbx-components/commit/168c8b96077f4bf091a12415f3174b20687de22d))
* fixed typing issues ([f59cecf](https://github.com/dereekb/dbx-components/commit/f59cecf5ae3b2c3577a9015a4b8606172c2da689))
* updated types for @Export() types due to jest issue ([24b2b65](https://github.com/dereekb/dbx-components/commit/24b2b65b6067aafd3133f88d23f16f62a20e6068))


### Features

* added dateScheduleDateFilter() ([ab0e381](https://github.com/dereekb/dbx-components/commit/ab0e3810f3fc74695dc558a27e9c9d6d45302e1f))
* added DateScheduleDayCode ([0984e33](https://github.com/dereekb/dbx-components/commit/0984e3314d922886c0fbb3cbdc54c306e2577113))
* added dateScheduleRangeField() ([#22](https://github.com/dereekb/dbx-components/issues/22)) ([1979f3b](https://github.com/dereekb/dbx-components/commit/1979f3b4573315ff4a2b289cc2e645718f33a29c))
* added IsDateWithinDateBlockRangeFunction ([994c6b1](https://github.com/dereekb/dbx-components/commit/994c6b1a018bfb81801775b2901c565aab1d52c8))



## [9.17.3](https://github.com/dereekb/dbx-components/compare/v9.17.2-dev...v9.17.3) (2022-12-01)



## [9.17.2](https://github.com/dereekb/dbx-components/compare/v9.17.1-dev...v9.17.2) (2022-11-28)



## [9.17.1](https://github.com/dereekb/dbx-components/compare/v9.17.0-dev...v9.17.1) (2022-11-27)


### Bug Fixes

* added handleFetchJsonParseErrorFunction config ([71c1681](https://github.com/dereekb/dbx-components/commit/71c16810abd7d490769ae956cfa7e9f2e4d5a514))



# [9.17.0](https://github.com/dereekb/dbx-components/compare/v9.16.4-dev...v9.17.0) (2022-11-25)


### Bug Fixes

* styling fix ([c883a2c](https://github.com/dereekb/dbx-components/commit/c883a2cc9599405b0577006d2897cb26bcbb6f87))


### Features

* added DbxItemListFieldComponent ([467a879](https://github.com/dereekb/dbx-components/commit/467a879934737cdfd18c9211ee775c4990ac502a))
* added dbxListItemIsSelectedModifier ([7dea240](https://github.com/dereekb/dbx-components/commit/7dea240f3d8efc4c55b03877d5662aa8c89c5992))
* added duplicate button to repeatArrayField ([f4e027b](https://github.com/dereekb/dbx-components/commit/f4e027b9b30a9875581b262cee4547e80ba2e791))



## [9.16.4](https://github.com/dereekb/dbx-components/compare/v9.16.3-dev...v9.16.4) (2022-11-23)



## [9.16.3](https://github.com/dereekb/dbx-components/compare/v9.16.2-dev...v9.16.3) (2022-11-23)



## [9.16.2](https://github.com/dereekb/dbx-components/compare/v9.16.1-dev...v9.16.2) (2022-11-22)


### Bug Fixes

* fixed nameField() not passing through expressions and config ([b6c9f76](https://github.com/dereekb/dbx-components/commit/b6c9f76edba069939af61f5c0a0875994419118b))
* fixed toggleField() description position ([a0ac203](https://github.com/dereekb/dbx-components/commit/a0ac20398f32961173462a09ecdf046674e11aef))



## [9.16.1](https://github.com/dereekb/dbx-components/compare/v9.16.0-dev...v9.16.1) (2022-11-20)


### Bug Fixes

* fixed DbxFormSourceDirective always mode ([ed73d44](https://github.com/dereekb/dbx-components/commit/ed73d44debc11ecbb9f1923d79ee856b0527ad4b))



# [9.16.0](https://github.com/dereekb/dbx-components/compare/v9.15.8-dev...v9.16.0) (2022-11-20)


### Features

* added DbxPresetMenuFilter ([2c08ad7](https://github.com/dereekb/dbx-components/commit/2c08ad79e464dac307d0dd347487b4e7d3d75a6b))



## [9.15.8](https://github.com/dereekb/dbx-components/compare/v9.15.7-dev...v9.15.8) (2022-11-19)


### Bug Fixes

* fixed dbxFormSourceObservable() emission ([cf927b4](https://github.com/dereekb/dbx-components/commit/cf927b4345ab1bd9d8d0eb4addcd4f7b9efba9e0))



## [9.15.7](https://github.com/dereekb/dbx-components/compare/v9.15.6-dev...v9.15.7) (2022-11-17)



## [9.15.6](https://github.com/dereekb/dbx-components/compare/v9.15.5-dev...v9.15.6) (2022-11-17)


### Bug Fixes

* dbx-section style fixes ([2bdaa88](https://github.com/dereekb/dbx-components/commit/2bdaa888177fcd6cc939b42e552e0445db4a86c3))
* fixed dateTimeField input issue ([5823200](https://github.com/dereekb/dbx-components/commit/582320020557595c1cfb797224e63b8307c0f41f))



## [9.15.5](https://github.com/dereekb/dbx-components/compare/v9.15.4-dev...v9.15.5) (2022-11-14)


### Bug Fixes

* fixed modelFirebaseFunctionMapFactory() short specifier ([ae28afe](https://github.com/dereekb/dbx-components/commit/ae28afef90df357980ec516e250c5c82899fb896))
* fixed redirectForUserIdentifierParamHook() ([1be07a3](https://github.com/dereekb/dbx-components/commit/1be07a3ea9a0b7f8fbe583fe2914b5245cad7b98))
* removed console print from DbxFirebaseEmulatorService ([8e5b622](https://github.com/dereekb/dbx-components/commit/8e5b6221dc193c7a3eb729cd9932b4817f1097d9))



## [9.15.4](https://github.com/dereekb/dbx-components/compare/v9.15.3-dev...v9.15.4) (2022-11-13)



## [9.15.3](https://github.com/dereekb/dbx-components/compare/v9.15.2-dev...v9.15.3) (2022-11-13)



## [9.15.2](https://github.com/dereekb/dbx-components/compare/v9.15.1-dev...v9.15.2) (2022-11-12)



## [9.15.1](https://github.com/dereekb/dbx-components/compare/v9.15.0-dev...v9.15.1) (2022-11-11)



# [9.15.0](https://github.com/dereekb/dbx-components/compare/v9.14.2-dev...v9.15.0) (2022-11-10)


### Bug Fixes

* fixed dbxActionConfirm input ([b31a350](https://github.com/dereekb/dbx-components/commit/b31a350ef62798dc4dc0e38e431c6f113d502376))
* fixed generateRandomSetupPassword() generating decimals ([a2d67a8](https://github.com/dereekb/dbx-components/commit/a2d67a878ad7df80cf68a407de0c9ce6abdf8312))
* fixed styling with elevation in dbx-section ([c203ac8](https://github.com/dereekb/dbx-components/commit/c203ac8bb58a1653a26507c1e82d94a924677073))


### Features

* added redirectForUserIdentifierParamHook ([0f8467d](https://github.com/dereekb/dbx-components/commit/0f8467d928200b35b10484dafe5bf5a6aff7d455))



## [9.14.2](https://github.com/dereekb/dbx-components/compare/v9.14.1-dev...v9.14.2) (2022-11-09)



## [9.14.1](https://github.com/dereekb/dbx-components/compare/v9.14.0-dev...v9.14.1) (2022-11-09)



# [9.14.0](https://github.com/dereekb/dbx-components/compare/v9.13.0-dev...v9.14.0) (2022-11-09)


### Features

* added firebaseDocumentStoreReadFunction() ([f2fd7ee](https://github.com/dereekb/dbx-components/commit/f2fd7eef3b088a615b9226231fde3342676f4f64))



# [9.13.0](https://github.com/dereekb/dbx-components/compare/v9.12.4-dev...v9.13.0) (2022-11-08)


### Bug Fixes

* fixed issue where empty queries were being appended to url ([2c787e8](https://github.com/dereekb/dbx-components/commit/2c787e83b505ef48b84034a22a66fcc2e478014f))


### Features

* added OnCallReadModelFunction ([4c0eeb9](https://github.com/dereekb/dbx-components/commit/4c0eeb938ba409d66ec5d049ef01802084c1a459))



## [9.12.4](https://github.com/dereekb/dbx-components/compare/v9.12.3-dev...v9.12.4) (2022-11-08)


### Bug Fixes

* fixed fetch issues ([8859b49](https://github.com/dereekb/dbx-components/commit/8859b4967030e9cecc336195f4d12551b9cc8d93))



## [9.12.3](https://github.com/dereekb/dbx-components/compare/v9.12.2-dev...v9.12.3) (2022-11-07)



## [9.12.2](https://github.com/dereekb/dbx-components/compare/v9.12.1-dev...v9.12.2) (2022-11-07)


### Bug Fixes

* adding missing exports ([b2c6b0d](https://github.com/dereekb/dbx-components/commit/b2c6b0db82215a2d0600034f0361d7dc9edffb94))



## [9.12.1](https://github.com/dereekb/dbx-components/compare/v9.12.0-dev...v9.12.1) (2022-11-07)



# [9.12.0](https://github.com/dereekb/dbx-components/compare/v9.11.13-dev...v9.12.0) (2022-11-07)


### Bug Fixes

* fixed dateBlockTiming() with 1 day distance ([5399706](https://github.com/dereekb/dbx-components/commit/5399706860274dfe005fb5939bd38468d4a4d7bf))


### Features

* added @dereekb/util/fetch ([6afa4a4](https://github.com/dereekb/dbx-components/commit/6afa4a48df62791a4b9ee8da67cb8e8bd00d3bcc))



## [9.11.13](https://github.com/dereekb/dbx-components/compare/v9.11.12-dev...v9.11.13) (2022-11-05)



## [9.11.12](https://github.com/dereekb/dbx-components/compare/v9.11.11-dev...v9.11.12) (2022-11-04)


### Bug Fixes

* added system files to setup ([2251546](https://github.com/dereekb/dbx-components/commit/2251546683f4befefc37f78070eaa362c93c7e24))
* fixed circular dependency import ([9b68403](https://github.com/dereekb/dbx-components/commit/9b68403cbc86612bc4f608e63028ced2d9853bdb))



## [9.11.11](https://github.com/dereekb/dbx-components/compare/v9.11.10-dev...v9.11.11) (2022-11-01)



## [9.11.10](https://github.com/dereekb/dbx-components/compare/v9.11.9-dev...v9.11.10) (2022-10-28)


### Bug Fixes

* assignValuesToPOJOFunction() now uses a copy by default ([e7f446d](https://github.com/dereekb/dbx-components/commit/e7f446da0687b3c9757f7c83f8fe36333403fed2))



## [9.11.9](https://github.com/dereekb/dbx-components/compare/v9.11.8-dev...v9.11.9) (2022-10-28)



## [9.11.8](https://github.com/dereekb/dbx-components/compare/v9.11.7-dev...v9.11.8) (2022-10-26)



## [9.11.7](https://github.com/dereekb/dbx-components/compare/v9.11.6-dev...v9.11.7) (2022-10-20)



## [9.11.6](https://github.com/dereekb/dbx-components/compare/v9.11.5-dev...v9.11.6) (2022-10-13)



## [9.11.5](https://github.com/dereekb/dbx-components/compare/v9.11.4-dev...v9.11.5) (2022-10-13)



## [9.11.4](https://github.com/dereekb/dbx-components/compare/v9.11.3-dev...v9.11.4) (2022-10-10)



## [9.11.3](https://github.com/dereekb/dbx-components/compare/v9.11.2-dev...v9.11.3) (2022-10-10)



## [9.11.2](https://github.com/dereekb/dbx-components/compare/v9.11.1-dev...v9.11.2) (2022-10-09)



## [9.11.1](https://github.com/dereekb/dbx-components/compare/v9.11.0-dev...v9.11.1) (2022-10-09)


### Bug Fixes

* fixed cronExpressionRepeatingEveryNMinutes ([63a7f8c](https://github.com/dereekb/dbx-components/commit/63a7f8c48a2bf18c6b2ee712c47a71c95edbd35f))
* fixed DbxFirebaseDevelopmentSchedulerService error handling ([3763fdf](https://github.com/dereekb/dbx-components/commit/3763fdf830fbc6d0f2d134d0d66513b2dab39964))



# [9.11.0](https://github.com/dereekb/dbx-components/compare/v9.10.4-dev...v9.11.0) (2022-10-09)


### Features

* added SystemStateDocument ([d4a0fcf](https://github.com/dereekb/dbx-components/commit/d4a0fcf53e4e98c91ec8915e9122b7af9ded35f7))



## [9.10.4](https://github.com/dereekb/dbx-components/compare/v9.10.3-dev...v9.10.4) (2022-10-07)



## [9.10.3](https://github.com/dereekb/dbx-components/compare/v9.10.2-dev...v9.10.3) (2022-10-07)



## [9.10.2](https://github.com/dereekb/dbx-components/compare/v9.10.1-dev...v9.10.2) (2022-10-06)


### Bug Fixes

* fixed DbxPickableItemField selection ([1c980e6](https://github.com/dereekb/dbx-components/commit/1c980e69d52a3381a1c7ee7a44f9c3b6c8d2b217))
* fixed scheduler cron issue ([8a96047](https://github.com/dereekb/dbx-components/commit/8a960475ee43908f54d839e76c4d0320976a403d))



## [9.10.1](https://github.com/dereekb/dbx-components/compare/v9.10.0-dev...v9.10.1) (2022-10-06)


### Bug Fixes

* dependency fix ([3445223](https://github.com/dereekb/dbx-components/commit/3445223b048b323d918b07298a2823205af616f6))
* onScheduleWithNestApplicationFactory fix ([3736e30](https://github.com/dereekb/dbx-components/commit/3736e307056c306b23a617ade294273059c1a323))



# [9.10.0](https://github.com/dereekb/dbx-components/compare/v9.9.5-dev...v9.10.0) (2022-10-05)


### Features

* added DbxFirebaseDevelopmentModule ([f604882](https://github.com/dereekb/dbx-components/commit/f604882d189f755ba039b8e0ee0a57245410013a))
* added DbxFirebaseDevelopmentSchedulerService ([713bac5](https://github.com/dereekb/dbx-components/commit/713bac57dd1864c52394a16d990f04fc81e0c543))
* added DbxFirebaseDevelopmentSchedulerWidgetComponent ([99c5712](https://github.com/dereekb/dbx-components/commit/99c57122976a6afefbd2a458819861ce47c6ec60))
* added firebase scheduled tasks ([2114446](https://github.com/dereekb/dbx-components/commit/2114446acb1704e93cabd2933d5876f8d9adb56a))
* added firebaseServerDevFunctions() ([375e3ac](https://github.com/dereekb/dbx-components/commit/375e3acf4e7539bdca37c68b50617ea455690d69))



## [9.9.5](https://github.com/dereekb/dbx-components/compare/v9.9.4-dev...v9.9.5) (2022-09-19)


### Bug Fixes

* fixed primativeKeyStringDencoder() decoding ([427faf1](https://github.com/dereekb/dbx-components/commit/427faf1052163eedd84c84fdcaf83e62d0e627dd))



## [9.9.4](https://github.com/dereekb/dbx-components/compare/v9.9.3-dev...v9.9.4) (2022-09-19)



## [9.9.3](https://github.com/dereekb/dbx-components/compare/v9.9.2-dev...v9.9.3) (2022-09-19)



## [9.9.2](https://github.com/dereekb/dbx-components/compare/v9.9.1-dev...v9.9.2) (2022-09-19)


### Bug Fixes

* fixed child package exports ([76fe1fa](https://github.com/dereekb/dbx-components/commit/76fe1fac1b99853e705ae09bea6dee3e65d7338c))



## [9.9.1](https://github.com/dereekb/dbx-components/compare/v9.9.0-dev...v9.9.1) (2022-09-18)


### Bug Fixes

* fixed dependencies for release ([7c57c7e](https://github.com/dereekb/dbx-components/commit/7c57c7ef5df664b8df2641fb3b50b82b3fb2c650))



# [9.9.0](https://github.com/dereekb/dbx-components/compare/v9.8.0-dev...v9.9.0) (2022-09-17)


### Features

* mailgun ([#16](https://github.com/dereekb/dbx-components/issues/16)) ([9c7d4cc](https://github.com/dereekb/dbx-components/commit/9c7d4cc997e86b664ff7e2bc6e04392e650b7910))



# [9.8.0](https://github.com/dereekb/dbx-components/compare/v9.7.7-dev...v9.8.0) (2022-09-15)


### Features

* added FirebaseServerNewUserService ([10d64dc](https://github.com/dereekb/dbx-components/commit/10d64dc137e533a62d7449709a93056741a840e4))



## [9.7.7](https://github.com/dereekb/dbx-components/compare/v9.7.6-dev...v9.7.7) (2022-09-12)



## [9.7.6](https://github.com/dereekb/dbx-components/compare/v9.7.5-dev...v9.7.6) (2022-09-12)



## [9.7.5](https://github.com/dereekb/dbx-components/compare/v9.7.4-dev...v9.7.5) (2022-09-10)



## [9.7.4](https://github.com/dereekb/dbx-components/compare/v9.7.3-dev...v9.7.4) (2022-09-08)


### Bug Fixes

* fixed issue with easeTo input ([eb03604](https://github.com/dereekb/dbx-components/commit/eb03604c99de548b9f8e6a6b0553a1bd27d209c9))
* fixed zoom limits in DbxFormMapboxZoomFieldComponent ([a49e72c](https://github.com/dereekb/dbx-components/commit/a49e72caec7cbe959fd310614917d72cd900bfdb))



## [9.7.3](https://github.com/dereekb/dbx-components/compare/v9.7.2-dev...v9.7.3) (2022-09-06)


### Bug Fixes

* fixed readKeysFunction array creation ([cab3ce7](https://github.com/dereekb/dbx-components/commit/cab3ce7013880b89e0cce91ebb470cf6404d1875))



## [9.7.2](https://github.com/dereekb/dbx-components/compare/v9.7.1-dev...v9.7.2) (2022-09-06)



## [9.7.1](https://github.com/dereekb/dbx-components/compare/v9.7.0-dev...v9.7.1) (2022-09-06)



# [9.7.0](https://github.com/dereekb/dbx-components/compare/v9.6.5-dev...v9.7.0) (2022-09-05)


### Bug Fixes

* fixed DbxFormMapboxLatLngFieldComponent input wrap ([0e4de7b](https://github.com/dereekb/dbx-components/commit/0e4de7b6a56ee1fe67b8fa4a3cc983c263b97ae6))


### Features

* added filterByMapboxViewportBound() ([a6beb56](https://github.com/dereekb/dbx-components/commit/a6beb56abf9d546eb00de2e7601316f80ccb925e))



## [9.6.5](https://github.com/dereekb/dbx-components/compare/v9.6.4-dev...v9.6.5) (2022-09-04)


### Bug Fixes

* fixed isLatLngPointWithinLatLngBound() ([d57c369](https://github.com/dereekb/dbx-components/commit/d57c369393e337299fccd4fec64366d43fe3cd56))



## [9.6.4](https://github.com/dereekb/dbx-components/compare/v9.6.3-dev...v9.6.4) (2022-09-03)



## [9.6.3](https://github.com/dereekb/dbx-components/compare/v9.6.2-dev...v9.6.3) (2022-09-02)



## [9.6.2](https://github.com/dereekb/dbx-components/compare/v9.6.1-dev...v9.6.2) (2022-09-02)



## [9.6.1](https://github.com/dereekb/dbx-components/compare/v9.6.0-dev...v9.6.1) (2022-08-31)



# [9.6.0](https://github.com/dereekb/dbx-components/compare/v9.5.5-dev...v9.6.0) (2022-08-31)


### Bug Fixes

* added error handling to DbxFirebaseAuthService authUserState ([206132f](https://github.com/dereekb/dbx-components/commit/206132f2dcc0c40adfd889ad98f70396021f87d1))


### Features

* added mapboxZoomField() ([9ab3574](https://github.com/dereekb/dbx-components/commit/9ab357482d475b5410927e8a3b71c54c26f225b5))



## [9.5.5](https://github.com/dereekb/dbx-components/compare/v9.5.4-dev...v9.5.5) (2022-08-30)


### Bug Fixes

* fixed isLatestSuccessfulRoute() initial value ([fbde919](https://github.com/dereekb/dbx-components/commit/fbde91949b9e331b58d3aa7907198b5431220952))



## [9.5.4](https://github.com/dereekb/dbx-components/compare/v9.5.3-dev...v9.5.4) (2022-08-30)


### Bug Fixes

* fixed issue where firebaseDocumentStoreUpdateFunction() repeated ([c5e76c5](https://github.com/dereekb/dbx-components/commit/c5e76c5c3f7f419cd5c9e9342f5a2fb01cf6abfb))



## [9.5.3](https://github.com/dereekb/dbx-components/compare/v9.5.2-dev...v9.5.3) (2022-08-29)



## [9.5.2](https://github.com/dereekb/dbx-components/compare/v9.5.1-dev...v9.5.2) (2022-08-29)



## [9.5.1](https://github.com/dereekb/dbx-components/compare/v9.5.0-dev...v9.5.1) (2022-08-26)


### Bug Fixes

* fixed dbx-mapbox-menu ([6c975fb](https://github.com/dereekb/dbx-components/commit/6c975fbc7faad66c1b88afe3a54d267273e53051))



# [9.5.0](https://github.com/dereekb/dbx-components/compare/v9.4.0-dev...v9.5.0) (2022-08-24)


### Bug Fixes

* dbx mapbox drawer style fix ([54fa8f2](https://github.com/dereekb/dbx-components/commit/54fa8f21940200ecc1840211ec95e93a7e4c0421))


### Features

* added dbx-mapbox-menu ([8e310a7](https://github.com/dereekb/dbx-components/commit/8e310a7ec0908cb345f5277a1bde2a7a31652fa6))



# [9.4.0](https://github.com/dereekb/dbx-components/compare/v9.3.3-dev...v9.4.0) (2022-08-24)


### Bug Fixes

* fixed dbx-two-column-right styling ([501dc7e](https://github.com/dereekb/dbx-components/commit/501dc7e5fade0f9a2e20d2ad03de7271f5d1a57f))


### Features

* added dbx-map-layout ([4955020](https://github.com/dereekb/dbx-components/commit/49550205754cedc9fd431c7d6440f106147e3e0b))



## [9.3.3](https://github.com/dereekb/dbx-components/compare/v9.3.2-dev...v9.3.3) (2022-08-23)


### Bug Fixes

* fixed DbxMapboxMapDirective init issue ([789e368](https://github.com/dereekb/dbx-components/commit/789e3688819168e358f14904fec55b012fbbd969))



## [9.3.2](https://github.com/dereekb/dbx-components/compare/v9.3.1-dev...v9.3.2) (2022-08-22)



## [9.3.1](https://github.com/dereekb/dbx-components/compare/v9.3.0-dev...v9.3.1) (2022-08-21)



# [9.3.0](https://github.com/dereekb/dbx-components/compare/v9.2.0-dev...v9.3.0) (2022-08-20)


### Features

* added dbx-web-mapbox project ([5af3c3b](https://github.com/dereekb/dbx-components/commit/5af3c3b803db19c401b688d0c3c67ab9da4a1223))
* added DbxMapboxMapStore ([9397b9a](https://github.com/dereekb/dbx-components/commit/9397b9a5951abe909d4539176d266c2934189034))
* added IsWithinLatLngBoundFunction() ([c986e5b](https://github.com/dereekb/dbx-components/commit/c986e5bfe1742319526f0d1ec62e3c3a09c47d2d))
* added Mapbox functions to DbxMapboxStore ([9a9f5f4](https://github.com/dereekb/dbx-components/commit/9a9f5f4a22088be4a5c170dffe6cc2eb9f66731b))



# [9.2.0](https://github.com/dereekb/dbx-components/compare/v9.1.2-dev...v9.2.0) (2022-08-18)


### Features

* added DbxFormMapboxLatLngFieldComponent ([5ce4fbb](https://github.com/dereekb/dbx-components/commit/5ce4fbb470b056c5a92da119cc29fd867ca7fe60))
* added timezonePicker() ([a1b23c0](https://github.com/dereekb/dbx-components/commit/a1b23c03f742b20c3f8b631ee9a17730d16b9335))



## [9.1.2](https://github.com/dereekb/dbx-components/compare/v9.1.1-dev...v9.1.2) (2022-08-16)


### Bug Fixes

* fixed expandUniqueDateBlocksFunction() scenario ([2341c24](https://github.com/dereekb/dbx-components/commit/2341c246c8c95c360501b2cf2166dfc65eab9122))



## [9.1.1](https://github.com/dereekb/dbx-components/compare/v9.1.0-dev...v9.1.1) (2022-08-16)


### Bug Fixes

* fixed makeSingleItemFirestoreCollection ([4b8980d](https://github.com/dereekb/dbx-components/commit/4b8980ded100e67645b2deb3a2c12b08403fca62))



# [9.1.0](https://github.com/dereekb/dbx-components/compare/v9.0.0-dev...v9.1.0) (2022-08-15)


### Bug Fixes

* fixed serve loop scripts ([b465b37](https://github.com/dereekb/dbx-components/commit/b465b3797ad7ff8cebaf988a0ddc86cad52c33fb))


### Features

* added WebsiteFileLink ([dc58b5c](https://github.com/dereekb/dbx-components/commit/dc58b5c3a78c1e6fbf3ee065b02b270f15f4dc79))



# [9.0.0](https://github.com/dereekb/dbx-components/compare/v8.15.2-dev...v9.0.0) (2022-08-13)


### Code Refactoring

* lint-fix ([50b09dc](https://github.com/dereekb/dbx-components/commit/50b09dc8907de951335249fcad654901f44348be))


### Features

* updated to angular 14 ([#15](https://github.com/dereekb/dbx-components/issues/15)) ([739726e](https://github.com/dereekb/dbx-components/commit/739726eabdf49007b096dbb892054887268c7732))


### BREAKING CHANGES

* prepare major version



## [8.15.2](https://github.com/dereekb/dbx-components/compare/v8.15.1-dev...v8.15.2) (2022-08-11)



## [8.15.1](https://github.com/dereekb/dbx-components/compare/v8.15.0-dev...v8.15.1) (2022-08-11)


### Bug Fixes

* fixed infinite loop in expandUniqueDateBlocks() ([7464f2d](https://github.com/dereekb/dbx-components/commit/7464f2d33cb2f424a44cbfd3b8aa4a04a7304af6))



# [8.15.0](https://github.com/dereekb/dbx-components/compare/v8.14.0-dev...v8.15.0) (2022-08-09)


### Features

* added Firestore Increment support ([d4dc97b](https://github.com/dereekb/dbx-components/commit/d4dc97b92d4c592713019b1089a6ba8bacfc93be))



# [8.14.0](https://github.com/dereekb/dbx-components/compare/v8.13.9-dev...v8.14.0) (2022-08-08)


### Bug Fixes

* fixed issue with ModelFirebaseCrudFunctionMapEntry for create ([a5ff2ef](https://github.com/dereekb/dbx-components/commit/a5ff2efe6b80fab53b7258af1feb4e0285d90e72))


### Features

* added DbxWidgetViewComponent ([6cf8d3a](https://github.com/dereekb/dbx-components/commit/6cf8d3a701b84ada9db735de5d08d3967debb1a2))
* added WebsiteLink ([68eda11](https://github.com/dereekb/dbx-components/commit/68eda11f78f96c3f875bbd69fdc856b4164ea7a3))
* added WebsiteUrl and functions ([ed3430f](https://github.com/dereekb/dbx-components/commit/ed3430f7caba109fbcb9fc02764c22d3ee686fc4))



## [8.13.9](https://github.com/dereekb/dbx-components/compare/v8.13.8-dev...v8.13.9) (2022-08-05)


### Bug Fixes

* fixed issue with AbstractFirestoreDocument stream$ ([3752d11](https://github.com/dereekb/dbx-components/commit/3752d11f74d73b56759e513a57e5a7e979c223c1))



## [8.13.8](https://github.com/dereekb/dbx-components/compare/v8.13.7-dev...v8.13.8) (2022-08-03)



## [8.13.7](https://github.com/dereekb/dbx-components/compare/v8.13.6-dev...v8.13.7) (2022-08-03)



## [8.13.6](https://github.com/dereekb/dbx-components/compare/v8.13.5-dev...v8.13.6) (2022-08-01)



## [8.13.5](https://github.com/dereekb/dbx-components/compare/v8.13.4-dev...v8.13.5) (2022-07-29)



## [8.13.4](https://github.com/dereekb/dbx-components/compare/v8.13.3-dev...v8.13.4) (2022-07-23)


### Bug Fixes

* fixed ModifyBeforeSetFirestoreDocumentDataAccessorWrapper ([68b5fff](https://github.com/dereekb/dbx-components/commit/68b5fff454b8e30b838702c6747ed217937cf2ff))



## [8.13.3](https://github.com/dereekb/dbx-components/compare/v8.13.2-dev...v8.13.3) (2022-07-21)



## [8.13.2](https://github.com/dereekb/dbx-components/compare/v8.13.1-dev...v8.13.2) (2022-07-20)


### Bug Fixes

* firebase-server update fix ([38a52ca](https://github.com/dereekb/dbx-components/commit/38a52ca5894cded928127848b7a3b2e7283dbf18))



## [8.13.1](https://github.com/dereekb/dbx-components/compare/v8.13.0-dev...v8.13.1) (2022-07-19)



# [8.13.0](https://github.com/dereekb/dbx-components/compare/v8.12.13-dev...v8.13.0) (2022-07-16)


### Features

* added DayOfWeek functions ([16b08bc](https://github.com/dereekb/dbx-components/commit/16b08bc802124e20b0fc248cc842da6a65d9ca35))



## [8.12.13](https://github.com/dereekb/dbx-components/compare/v8.12.12-dev...v8.12.13) (2022-07-16)



## [8.12.12](https://github.com/dereekb/dbx-components/compare/v8.12.11-dev...v8.12.12) (2022-07-15)



## [8.12.11](https://github.com/dereekb/dbx-components/compare/v8.12.10-dev...v8.12.11) (2022-07-14)


### Bug Fixes

* setup-project string replace ([fd7adf1](https://github.com/dereekb/dbx-components/commit/fd7adf1a0578e8403737b38363a1d310d05b3586))



## [8.12.10](https://github.com/dereekb/dbx-components/compare/v8.12.9-dev...v8.12.10) (2022-07-13)


### Bug Fixes

* fixed AbstractSingleItemDbxFirebaseDocument setFirestoreCollection ([d0e8352](https://github.com/dereekb/dbx-components/commit/d0e83522e10b1923146c4db6ef241fe2640338ef))
* setup-project string replace ([a72284f](https://github.com/dereekb/dbx-components/commit/a72284f087fad509b9920e1fba8d6a7c9f354718))



## [8.12.9](https://github.com/dereekb/dbx-components/compare/v8.12.8-dev...v8.12.9) (2022-07-12)



## [8.12.8](https://github.com/dereekb/dbx-components/compare/v8.12.7-dev...v8.12.8) (2022-07-12)


### Bug Fixes

* optionalFirestoreDate() ([58e170c](https://github.com/dereekb/dbx-components/commit/58e170c9d890e3953c316b78cd01fb9b49f3bf29))



## [8.12.7](https://github.com/dereekb/dbx-components/compare/v8.12.6-dev...v8.12.7) (2022-07-11)



## [8.12.6](https://github.com/dereekb/dbx-components/compare/v8.12.5-dev...v8.12.6) (2022-07-11)



## [8.12.5](https://github.com/dereekb/dbx-components/compare/v8.12.4-dev...v8.12.5) (2022-07-10)



## [8.12.4](https://github.com/dereekb/dbx-components/compare/v8.12.3-dev...v8.12.4) (2022-07-10)



## [8.12.3](https://github.com/dereekb/dbx-components/compare/v8.12.2-dev...v8.12.3) (2022-07-09)



## [8.12.2](https://github.com/dereekb/dbx-components/compare/v8.12.1-dev...v8.12.2) (2022-07-08)



## [8.12.1](https://github.com/dereekb/dbx-components/compare/v8.12.0-dev...v8.12.1) (2022-07-08)



# [8.12.0](https://github.com/dereekb/dbx-components/compare/v8.11.2-dev...v8.12.0) (2022-07-07)


### Bug Fixes

* fixed two column reverseSizing ([c298776](https://github.com/dereekb/dbx-components/commit/c2987764dac307f6a9743f9172a68ea78b6e5f0a))


### Features

* added DateBlock ([b424dc0](https://github.com/dereekb/dbx-components/commit/b424dc09ada622b2c5a85335ce755516eb1fb767))
* added dbxCalendar ([88750cb](https://github.com/dereekb/dbx-components/commit/88750cb4302b8e67dcaadb4813979a8e73d1d7b7))
* added dbxCalendar Styling ([f963986](https://github.com/dereekb/dbx-components/commit/f9639863a9cfe599525604c7b8c2d1dcb513ee0d))
* added sass extension configuration ([5b3b33e](https://github.com/dereekb/dbx-components/commit/5b3b33ea3b542690c6e75242fa5186872f6599ef))



## [8.11.2](https://github.com/dereekb/dbx-components/compare/v8.11.1-dev...v8.11.2) (2022-07-05)


### Bug Fixes

* fixed slashPathType() ([180f2d6](https://github.com/dereekb/dbx-components/commit/180f2d645c10d772aa9ba4255ec3b0f2b8655096))



## [8.11.1](https://github.com/dereekb/dbx-components/compare/v8.11.0-dev...v8.11.1) (2022-07-05)


### Bug Fixes

* firebase storage test fix ([ff5c53a](https://github.com/dereekb/dbx-components/commit/ff5c53ab8a76a8b3ede356f2ba7d00006db3237f))



# [8.11.0](https://github.com/dereekb/dbx-components/compare/v8.10.0-dev...v8.11.0) (2022-07-05)


### Features

* added specifier for crud functions ([39e366e](https://github.com/dereekb/dbx-components/commit/39e366e09936b5963cd3e74bc127ad3146d14ef7))



# [8.10.0](https://github.com/dereekb/dbx-components/compare/v8.9.1-dev...v8.10.0) (2022-07-04)


### Bug Fixes

* added dependencies to setup-project.sh ([30c985d](https://github.com/dereekb/dbx-components/commit/30c985d222bc5985da9523484833bb2caa635e02))


### Features

* added DbxFirebaseStorageService ([deeaa02](https://github.com/dereekb/dbx-components/commit/deeaa02908f4acb754afc52d42033734bd034924))
* added exists(), uploadStream(), getBytes(), getStream() ([e3fe97e](https://github.com/dereekb/dbx-components/commit/e3fe97e5e985125a5ca653c40fd79c7980845863))
* added firebase storage testing/mock components ([a2524b7](https://github.com/dereekb/dbx-components/commit/a2524b79b50551ed97186c6cb2692bb072d7af48))
* added FirebaseServerStorageService ([38bf98a](https://github.com/dereekb/dbx-components/commit/38bf98aa76aaddcd0ae2a9487b9a661f7f9f4e6e))
* added FirebaseStorageContext ([5a30d46](https://github.com/dereekb/dbx-components/commit/5a30d465181d91ce92e7405636fb5414787ac8aa))
* added firebaseStorageContextFactory ([e940579](https://github.com/dereekb/dbx-components/commit/e9405795092fe4bc403967a93e0bff3a55fdd278))
* added list() and list exists() ([388c593](https://github.com/dereekb/dbx-components/commit/388c59350897fcc42d61eb723896e23c42211507))
* added SlashPath ([8c902ab](https://github.com/dereekb/dbx-components/commit/8c902ab0eb379783320f8a9375486a4e9ce0cd44))
* added string functions ([1866db5](https://github.com/dereekb/dbx-components/commit/1866db58d96a1d893d01ff2890a9bccb38e2ca61))
* added upload byte types, delete() ([655088b](https://github.com/dereekb/dbx-components/commit/655088b238ef80097a2f09c539a1282a608f246b))



## [8.9.1](https://github.com/dereekb/dbx-components/compare/v8.9.0-dev...v8.9.1) (2022-06-30)


### Bug Fixes

* fixed LatLngStringRef ([88d9afe](https://github.com/dereekb/dbx-components/commit/88d9afe64e3b6847cf965e0243674e3b057719ee))



# [8.9.0](https://github.com/dereekb/dbx-components/compare/v8.8.1-dev...v8.9.0) (2022-06-30)


### Features

* added firestoreLatLngString() ([2af3e5f](https://github.com/dereekb/dbx-components/commit/2af3e5fcbcae665994df5cc68d1c246b5417a07d))



## [8.8.1](https://github.com/dereekb/dbx-components/compare/v8.8.0-dev...v8.8.1) (2022-06-29)



# [8.8.0](https://github.com/dereekb/dbx-components/compare/v8.7.6-dev...v8.8.0) (2022-06-29)


### Features

* added FirestoreObjectArray ([e1050eb](https://github.com/dereekb/dbx-components/commit/e1050eb53c816025e016a07e2d7e41ee8c24362a))
* added firestoreSubObjectField() ([3d6fbe1](https://github.com/dereekb/dbx-components/commit/3d6fbe17a10dfddf3e9bc1cecd522ed61efd6c49))



## [8.7.6](https://github.com/dereekb/dbx-components/compare/v8.7.5-dev...v8.7.6) (2022-06-29)


### Bug Fixes

* added pattern to textAreaField() ([de64fa7](https://github.com/dereekb/dbx-components/commit/de64fa74291781bd3044074de252b893a7de60a9))
* fixed AbstractSingleItemDbxFirebaseDocument constructor ([c266603](https://github.com/dereekb/dbx-components/commit/c266603697414a661a3f546e2634b3641d47b77e))
* fixed DbxFormRepeatArrayTypeComponent mark touched ([eb1dcea](https://github.com/dereekb/dbx-components/commit/eb1dcea88e2917092464d1ac4bb8bc4c2adf08d8))



## [8.7.5](https://github.com/dereekb/dbx-components/compare/v8.7.4-dev...v8.7.5) (2022-06-28)


### Bug Fixes

* updated DbxFormlyFormComponent to poll for touched changes ([51670e4](https://github.com/dereekb/dbx-components/commit/51670e4c1cffd7f66665732a425ef071e995896b))
* wrapper props fix ([b002f39](https://github.com/dereekb/dbx-components/commit/b002f3985c40684eb25cf05f2d703cf08bf53758))



## [8.7.4](https://github.com/dereekb/dbx-components/compare/v8.7.3-dev...v8.7.4) (2022-06-26)


### Bug Fixes

* fixed DbxTwoColumnComponent styling ([77b4dd0](https://github.com/dereekb/dbx-components/commit/77b4dd0e90371c0841794f31e2db0442bf76416d))



## [8.7.3](https://github.com/dereekb/dbx-components/compare/v8.7.2-dev...v8.7.3) (2022-06-25)


### Bug Fixes

* added KeyAsString ([1337d42](https://github.com/dereekb/dbx-components/commit/1337d42c0877173f55fe07e73958643766912301))
* fixed filterKeyValueTupleFunction() keys filter ([dbf721f](https://github.com/dereekb/dbx-components/commit/dbf721fa74eb1678e61a3d1c8164d412e65ee4b0))



## [8.7.2](https://github.com/dereekb/dbx-components/compare/v8.7.1-dev...v8.7.2) (2022-06-24)


### Bug Fixes

* dbx-section-page fixes ([c23a9c4](https://github.com/dereekb/dbx-components/commit/c23a9c40e4935d7ec2b0b64928a0e50f6ceb5f9d))



## [8.7.1](https://github.com/dereekb/dbx-components/compare/v8.7.0-dev...v8.7.1) (2022-06-24)


### Bug Fixes

* fixed DbxTwoColumnSrefDirective input ([1df4eea](https://github.com/dereekb/dbx-components/commit/1df4eea03dab2e8e2d2f247cf763dddb1631692f))
* fixed validation messages ([b53656d](https://github.com/dereekb/dbx-components/commit/b53656dd4243d8f7b34d131d08ab1a2ba6a16b7b))



# [8.7.0](https://github.com/dereekb/dbx-components/compare/v8.6.1-dev...v8.7.0) (2022-06-23)


### Features

* added number field ([387b002](https://github.com/dereekb/dbx-components/commit/387b002509a2409c707d098512540add06a7b86a))
* added step, enforceStep to numberField ([a57b1c7](https://github.com/dereekb/dbx-components/commit/a57b1c7f9f0194874e4dcadafabf01ee49d44c48))



## [8.6.1](https://github.com/dereekb/dbx-components/compare/v8.6.0-dev...v8.6.1) (2022-06-23)


### Bug Fixes

* fixed AbstractDbxFirebaseDocumentStore key observables ([8f663a2](https://github.com/dereekb/dbx-components/commit/8f663a28e409837c1c36f00ad9a9b6ef805ddd15))



# [8.6.0](https://github.com/dereekb/dbx-components/compare/v8.5.3-dev...v8.6.0) (2022-06-22)


### Features

* added DbxValueListGridViewComponent ([cca9a62](https://github.com/dereekb/dbx-components/commit/cca9a62d078e9fc4a710aea5bb834eb22a7b952d))



## [8.5.3](https://github.com/dereekb/dbx-components/compare/v8.5.2-dev...v8.5.3) (2022-06-22)



## [8.5.2](https://github.com/dereekb/dbx-components/compare/v8.5.1-dev...v8.5.2) (2022-06-22)



## [8.5.1](https://github.com/dereekb/dbx-components/compare/v8.5.0-dev...v8.5.1) (2022-06-22)


### Bug Fixes

* fixed function factory ([f722fb5](https://github.com/dereekb/dbx-components/commit/f722fb55c6948feb75d69eb1a7dc1eee6d731cb4))



# [8.5.0](https://github.com/dereekb/dbx-components/compare/v8.4.0-dev...v8.5.0) (2022-06-22)


### Bug Fixes

* added dbxStyleBody to template root layout ([2897f90](https://github.com/dereekb/dbx-components/commit/2897f90b869b30c103c4c16a78796a8899f11098))
* setup-project fix ([9406bfc](https://github.com/dereekb/dbx-components/commit/9406bfc026616723bc0ea6388a2b47512455a733))


### Features

* added firestore key validators ([9d090db](https://github.com/dereekb/dbx-components/commit/9d090db1e84b97f11cc2b751dcbe7d2724960b2b))
* added Observable to ValueSelectionFieldConfig ([235c2de](https://github.com/dereekb/dbx-components/commit/235c2de9a1e0a7b40981cbe935038d379270f8ca))
* added searchStringFilterFunction() ([f91aaaf](https://github.com/dereekb/dbx-components/commit/f91aaafb7fc4c304fbbd7fc2a3d471c4573ebdf3))



# [8.4.0](https://github.com/dereekb/dbx-components/compare/v8.3.0-dev...v8.4.0) (2022-06-21)


### Features

* added useAsObservable() ([a0e363d](https://github.com/dereekb/dbx-components/commit/a0e363d101c03918ea1d688943d4091f29dde3eb))
* added valueSelectionField() ([2392a1b](https://github.com/dereekb/dbx-components/commit/2392a1b90a12f521945af214499484cc99c2d037))



# [8.3.0](https://github.com/dereekb/dbx-components/compare/v8.2.0-dev...v8.3.0) (2022-06-20)


### Features

* added DbxFirebaseDocumentLoaderInstance ([523d1df](https://github.com/dereekb/dbx-components/commit/523d1dff22ac979b75bd310677770665ec76ff63))
* added getDocumentSnapshotsData() ([dc26340](https://github.com/dereekb/dbx-components/commit/dc26340972df9f1a7a8b8767e2929ca956e9e4a5))



# [8.2.0](https://github.com/dereekb/dbx-components/compare/v8.1.2-dev...v8.2.0) (2022-06-20)


### Bug Fixes

* bump setup-project components version ([7c70476](https://github.com/dereekb/dbx-components/commit/7c704765692e9cbe21014082f36a52493bd27cd9))


### Features

* added DbxRouteParamDefaultInstance ([2608580](https://github.com/dereekb/dbx-components/commit/26085806ff2578ce2864140fc78e883b399c05e9))
* added DbxRouteParamReader ([a855283](https://github.com/dereekb/dbx-components/commit/a8552835aabbfa85814984a8fdafd7bd1fb2963e))



## [8.1.2](https://github.com/dereekb/dbx-components/compare/v8.1.1-dev...v8.1.2) (2022-06-19)



## [8.1.1](https://github.com/dereekb/dbx-components/compare/v8.1.0-dev...v8.1.1) (2022-06-18)



# [8.1.0](https://github.com/dereekb/dbx-components/compare/v8.0.1-dev...v8.1.0) (2022-06-18)


### Bug Fixes

* fixed issue with snapshot falsy default values being ignored ([b433bc4](https://github.com/dereekb/dbx-components/commit/b433bc4a63b04d5aab99e1cf67b058cf20e7cc6a))


### Features

* added jest fail test utilities ([#13](https://github.com/dereekb/dbx-components/issues/13)) ([5891777](https://github.com/dereekb/dbx-components/commit/5891777470a339892c8e7045c24b5dea174b1736))



## [8.0.1](https://github.com/dereekb/dbx-components/compare/v8.0.0-dev...v8.0.1) (2022-06-17)


### Bug Fixes

* fixed converter on loadDocument() ([1e680ac](https://github.com/dereekb/dbx-components/commit/1e680ac8c42f2777772b02fe7aa5a64d5abfa052))



# [8.0.0](https://github.com/dereekb/dbx-components/compare/v7.16.0-dev...v8.0.0) (2022-06-17)


### Code Refactoring

* removed converter from DocumentReference ([33e9f6a](https://github.com/dereekb/dbx-components/commit/33e9f6aa33b83b93f2e08331855c26791557316a))


### BREAKING CHANGES

* - removed converter from DocumentReference
- additionally, the following previous breaking changes were not properly tagged:
- converter is now required for firestoreContext collection config
- modelIdentity is now required in FirestoreContext firestore collection functions
- removed other deprecated functions



# [7.16.0](https://github.com/dereekb/dbx-components/compare/v7.15.2-dev...v7.16.0) (2022-06-17)


### Bug Fixes

* fixed documentRef not having converter configured ([308f3fa](https://github.com/dereekb/dbx-components/commit/308f3fa18502c36915d65a7b9d7404a2c3bacbce))


### Features

* added getWithConverter() ([aef4b27](https://github.com/dereekb/dbx-components/commit/aef4b27dabfa926af098d5c1afac4fb77302b4ef))



## [7.15.2](https://github.com/dereekb/dbx-components/compare/v7.15.1-dev...v7.15.2) (2022-06-17)


### Bug Fixes

* fixed model conversions ([18ac25f](https://github.com/dereekb/dbx-components/commit/18ac25f8389d77fc724ea12eb9a3352eb72a9501))



## [7.15.1](https://github.com/dereekb/dbx-components/compare/v7.15.0-dev...v7.15.1) (2022-06-16)


### Bug Fixes

* fixed defaults of firestore-snapshot array fields ([8d388a9](https://github.com/dereekb/dbx-components/commit/8d388a9a3216e2f7aca6144d9f5d0343d49ab5b0))



# [7.15.0](https://github.com/dereekb/dbx-components/compare/v7.14.0-dev...v7.15.0) (2022-06-16)


### Features

* added create to FirestoreDocumentDataAccessor ([9211975](https://github.com/dereekb/dbx-components/commit/921197542b80e6fd98245349c9cee98126d6c75b))



# [7.14.0](https://github.com/dereekb/dbx-components/compare/v7.13.1-dev...v7.14.0) (2022-06-15)


### Features

* added firestoreDocumentAccessor path validation ([b82fad1](https://github.com/dereekb/dbx-components/commit/b82fad123728cc9feb9ca450e9418467b6805f23))



## [7.13.1](https://github.com/dereekb/dbx-components/compare/v7.13.0-dev...v7.13.1) (2022-06-15)


### Bug Fixes

* fixed createTestFunctionContextOptions() authData typing ([ba017cd](https://github.com/dereekb/dbx-components/commit/ba017cd5c48fe96277c8c40a6c24d0f65d937214))
* fixed issue with permission.service.grant.ts declaration order ([b607404](https://github.com/dereekb/dbx-components/commit/b6074041cfeb69b9d17c39a4923fcae742defbab))



# [7.13.0](https://github.com/dereekb/dbx-components/compare/v7.12.0-dev...v7.13.0) (2022-06-14)


### Features

* added describeCloudFunctionTest() to handle a map of functions ([5545149](https://github.com/dereekb/dbx-components/commit/55451495c305726d89973613d7d5b9a5be9871bc))



# [7.12.0](https://github.com/dereekb/dbx-components/compare/v7.11.2-dev...v7.12.0) (2022-06-14)


### Features

* added isAdminOrTargetUserInRequestData() ([c597eb9](https://github.com/dereekb/dbx-components/commit/c597eb9ce968ae5e8d64f3bc2f6ba6520cb11681))
* updated firestoreModelKey() ([1459a15](https://github.com/dereekb/dbx-components/commit/1459a150b00cd657cc5a835652c17945ae85ca15))



## [7.11.2](https://github.com/dereekb/dbx-components/compare/v7.11.1-dev...v7.11.2) (2022-06-13)


### Bug Fixes

* fixed util jest test declaration order ([3a05fb1](https://github.com/dereekb/dbx-components/commit/3a05fb148668e1791b4c30282752da98ae918cbb))



## [7.11.1](https://github.com/dereekb/dbx-components/compare/v7.11.0-dev...v7.11.1) (2022-06-13)


### Bug Fixes

* firebase dependency fix ([0ebd9b9](https://github.com/dereekb/dbx-components/commit/0ebd9b946f5d1accfb25f2e73296c7051331cc8f))



# [7.11.0](https://github.com/dereekb/dbx-components/compare/v7.10.0-dev...v7.11.0) (2022-06-13)


### Bug Fixes

* @nrwl/devkit version fix ([1818b79](https://github.com/dereekb/dbx-components/commit/1818b79a391036dd740bad6114994d7e8c379491))
* added test-setup.ts config to setup-project.sh ([d374bf5](https://github.com/dereekb/dbx-components/commit/d374bf54af9114a63c9cefee30190376e12555ba))


### Features

* added arrayToObject() ([edc723f](https://github.com/dereekb/dbx-components/commit/edc723f94a39f56dd6d43827595ee267830bf897))



# [7.10.0](https://github.com/dereekb/dbx-components/compare/v7.9.0-dev...v7.10.0) (2022-06-11)


### Features

* added firestoreIdBatchVerifierFactory() ([182f086](https://github.com/dereekb/dbx-components/commit/182f086f80671fa38ed1268a6c98854f114ba629))
* added idBatchFactory() ([b39510b](https://github.com/dereekb/dbx-components/commit/b39510b7b617e927da48efe03b3121f74fe192e8))



# [7.9.0](https://github.com/dereekb/dbx-components/compare/v7.8.1-dev...v7.9.0) (2022-06-11)


### Bug Fixes

* firestoreString now has a type specified ([ac7db1f](https://github.com/dereekb/dbx-components/commit/ac7db1f5d145ce5b98c37e45029db2b06d40d329))


### Features

* added arrayFactory() ([5a7ef13](https://github.com/dereekb/dbx-components/commit/5a7ef13116ebbacd8b7a9502e3298fd30708f944))
* added makeWithFactory() ([4a6f4a0](https://github.com/dereekb/dbx-components/commit/4a6f4a01a04e7800653bc942fe56b27ec457813e))
* added performBatchLoop() ([7c6c947](https://github.com/dereekb/dbx-components/commit/7c6c9475eacfd3cc7f153ef949fef1187925a8cb))



## [7.8.1](https://github.com/dereekb/dbx-components/compare/v7.8.0-dev...v7.8.1) (2022-06-10)


### Bug Fixes

* useAsync typings fixes with Maybe ([68f38a4](https://github.com/dereekb/dbx-components/commit/68f38a46559e48c61e8449622e69f2e610aeb1b4))



# [7.8.0](https://github.com/dereekb/dbx-components/compare/v7.7.0-dev...v7.8.0) (2022-06-09)


### Bug Fixes

* firestoreEnum test fix ([5996b79](https://github.com/dereekb/dbx-components/commit/5996b79c292aaed67137738ac95652dce81060c7))
* import path fixes ([0b72558](https://github.com/dereekb/dbx-components/commit/0b7255845e2502ed28d7f6b81711765acd72b452))


### Features

* added firestoreEnum() ([28e6704](https://github.com/dereekb/dbx-components/commit/28e670414f87eb538e996c5d823b5f79e9d9ae97))
* added firestoreEnumArray() ([5f9e1b1](https://github.com/dereekb/dbx-components/commit/5f9e1b14237ff229a4a832b8fbd5f13a21f753a6))



# [7.7.0](https://github.com/dereekb/dbx-components/compare/v7.6.0-dev...v7.7.0) (2022-06-09)


### Bug Fixes

* documentAccessorForTransaction/WriteBatch now accepts a Maybe value ([beb1737](https://github.com/dereekb/dbx-components/commit/beb173794ce2cf60b41e43ccfc2b4e4eeda53224))
* fixed grantFullAccessIfAuthUserRelated typings ([f83af85](https://github.com/dereekb/dbx-components/commit/f83af852f1fbad20ba86eb477d18f54e936dd41c))
* grantFullAccessIfAuthUserRelated() now takes in a document or model ([53563dd](https://github.com/dereekb/dbx-components/commit/53563dd93a9ae25e84b6ef7f3e9d7ce857254bc6))


### Features

* added UseAsync ([f52ff34](https://github.com/dereekb/dbx-components/commit/f52ff345621ecbcb4d6b0f2957dcd7f4f901ac3a))
* added useDocumentSnapshotData ([aa329f2](https://github.com/dereekb/dbx-components/commit/aa329f25cb105c871bc0fb22001abb7a98979b14))



# [7.6.0](https://github.com/dereekb/dbx-components/compare/v7.5.0-dev...v7.6.0) (2022-06-09)


### Features

* added grantFullAccessIfAuthUserRelated() ([be05e09](https://github.com/dereekb/dbx-components/commit/be05e0939939e9e0d1c8d1d8afbcab1fb15e060b))
* added wrapUseFunction() ([7bbae2f](https://github.com/dereekb/dbx-components/commit/7bbae2fdcbf8344c04c5c26db1d5a40b8048985b))



# [7.5.0](https://github.com/dereekb/dbx-components/compare/v7.4.0-dev...v7.5.0) (2022-06-08)


### Bug Fixes

* updated GrantRolesOtherwiseFunction to allow returning Maybe ([552bb9c](https://github.com/dereekb/dbx-components/commit/552bb9c488c0f11aa1aca885d00c5a7c2a199591))


### Features

* added UseFunction, MappedUseFunction ([84b6cbe](https://github.com/dereekb/dbx-components/commit/84b6cbe23b7e020ad7de49633642429d7e32f7d4))



# [7.4.0](https://github.com/dereekb/dbx-components/compare/v7.3.0-dev...v7.4.0) (2022-06-08)


### Features

* added grantModelRolesIfFunction and related types ([5432fab](https://github.com/dereekb/dbx-components/commit/5432fab1677c29e24eac4015c35821aba2d64e10))
* added ignore to AuthRoleClaimsFactoryConfig ([71e3cac](https://github.com/dereekb/dbx-components/commit/71e3cacad2ba211e5d64c4c60d8c62799b570fed))
* updated FirebaseServerAuthUserContext to be synchronous ([92bfd84](https://github.com/dereekb/dbx-components/commit/92bfd849b4a6d6773c616069c3085b686938ef4d))



# [7.3.0](https://github.com/dereekb/dbx-components/compare/v7.2.0-dev...v7.3.0) (2022-06-08)


### Bug Fixes

* fixed issue with example crud functions declaration ([8cb0aac](https://github.com/dereekb/dbx-components/commit/8cb0aac5b744b7f2b8f1e07b3fa432b75d747a1e))
* locked nx version in setup-project ([25a30ed](https://github.com/dereekb/dbx-components/commit/25a30ed089376e1c99d06424f46039479798eb5c))
* versions bump ([3a1a6cf](https://github.com/dereekb/dbx-components/commit/3a1a6cf5e594a9cd8dfb504fc2e14f561abe8413))


### Features

* added additional KeyValueTypleValueFilter values ([715b615](https://github.com/dereekb/dbx-components/commit/715b6150ee21629667c26c8c90745bb969937482))
* added FirestoreMap, FirestoreArrayMap snapshot fields ([bd23fd3](https://github.com/dereekb/dbx-components/commit/bd23fd372e3f2180980d7aec9c1b6ee1ec2bb3c7))
* added function builders for object filters ([c01db20](https://github.com/dereekb/dbx-components/commit/c01db2045412d513ae804f9a2d6154a267aae7cb))
* added overrideInObjectFunctionFactory, mergeObjectsFunction ([4ea7d65](https://github.com/dereekb/dbx-components/commit/4ea7d6569e6aed0838cdf7218fd63824ff5a7b98))
* updated [@ngx-formly](https://github.com/ngx-formly) to 6.0.0-beta.2 ([6f1737a](https://github.com/dereekb/dbx-components/commit/6f1737ab61473497b4c69c097b9f87da3f881c74))



# [7.2.0](https://github.com/dereekb/dbx-components/compare/v7.1.0-dev...v7.2.0) (2022-06-06)


### Features

* firestoreModeIdentity can now accept a collection name ([1e0646e](https://github.com/dereekb/dbx-components/commit/1e0646e598a0834d8b4c3d264bb5ee42626e9fc7))



# [7.1.0](https://github.com/dereekb/dbx-components/compare/v7.0.1-dev...v7.1.0) (2022-06-06)


### Features

* added firestoreArray ([e852230](https://github.com/dereekb/dbx-components/commit/e85223077246c1755cdb1028deea7019a6c71206))
* added firestoreEncodedArray, firestoreUniqueArray ([4f7fc7c](https://github.com/dereekb/dbx-components/commit/4f7fc7ca274656ecdf13d69aa7d225f66a7f76da))
* added interceptAccessorFactory() ([9833539](https://github.com/dereekb/dbx-components/commit/98335398eaa6a3ee363bdf64a440d5438bbefb24))
* added loadDocumentForId() to FirestoreDocumentAccessor ([3728145](https://github.com/dereekb/dbx-components/commit/372814540064ff4b40be032d57ddda12a8698d53))
* added ModelModifier ([118bde7](https://github.com/dereekb/dbx-components/commit/118bde78f04162f5dcad5d64feef2efb42c62d65))
* added whereDocumentId() ([7f5f5b8](https://github.com/dereekb/dbx-components/commit/7f5f5b8a56b2e0ad2e43308cfd87b4f8b8503c59))



## [7.0.1](https://github.com/dereekb/dbx-components/compare/v7.0.0-dev...v7.0.1) (2022-06-05)


### Bug Fixes

* util import path fixes ([e786b20](https://github.com/dereekb/dbx-components/commit/e786b207916e7679d321a5bf03f7bc00d4539234))



# [7.0.0](https://github.com/dereekb/dbx-components/compare/v6.0.0-dev...v7.0.0) (2022-06-05)


### Code Refactoring

* updated OnCallWithNestContextRequest to use single object ([2ef4002](https://github.com/dereekb/dbx-components/commit/2ef4002153d3e4b7efb012e31b2739378ac49789))


### Features

* added FirestoreDocumentStore crud functions ([7786a40](https://github.com/dereekb/dbx-components/commit/7786a40f6033c2a1d5161805cde283dca7323db5))
* added onCallCreateModel ([84f7e72](https://github.com/dereekb/dbx-components/commit/84f7e72af20c1d0071feec3e46bae406d7fd5a26))
* added useModel to AbstractFirebaseNestContext ([29c1940](https://github.com/dereekb/dbx-components/commit/29c19402bff78d743d28ef88093757844f8ee5f7))


### BREAKING CHANGES

* updated all onCall and functions to now use a single request object instead of multiple parameters



# [6.0.0](https://github.com/dereekb/dbx-components/compare/v5.3.0-dev...v6.0.0) (2022-06-03)


### Bug Fixes

* added asIterable to handle strings ([9d5b785](https://github.com/dereekb/dbx-components/commit/9d5b7854b6ce4f3c08b4b36fa75419fb97e8d548))
* hasAuthRoleHook fix ([e4749ba](https://github.com/dereekb/dbx-components/commit/e4749bae9a657d7cdc82974d129211392261aa3c))
* hasAuthStateData interface fix ([8ea59e3](https://github.com/dereekb/dbx-components/commit/8ea59e3cba1e0407e6e1ed7b2dd4176a68c2fa09))


### Features

* added AbstractFirebaseNestContext ([2f8e1a2](https://github.com/dereekb/dbx-components/commit/2f8e1a2127ffcfb23a428d6b46192633d8bf725f))
* added ContextGrantedModelRolesReader ([6fba1cc](https://github.com/dereekb/dbx-components/commit/6fba1cc637beeff55523df599eb88391352f9f58))
* added FirebaseModelService ([3876575](https://github.com/dereekb/dbx-components/commit/387657559a86908eee57326b655c63a0a836c239))
* added FirebaseModelsPermissionService ([9d75de4](https://github.com/dereekb/dbx-components/commit/9d75de4052dcfb15ef680d30f476ef494d8328a9))
* added firebaseModelsService ([7432e55](https://github.com/dereekb/dbx-components/commit/7432e55111cec66a239856ecb2db6adfc9e9780d))
* added grantedRoleMapReader ([11d2f17](https://github.com/dereekb/dbx-components/commit/11d2f1786f06024dfbbbfd9ac00e48791cbc0521))
* added InModelContextFirebaseModelServiceFactory ([9bf4697](https://github.com/dereekb/dbx-components/commit/9bf469731699a16ad27c96e3b149f552a429b471))
* added loadDocumentForKey to LimitedFirestoreDocumentAccessor ([96958b8](https://github.com/dereekb/dbx-components/commit/96958b89df62dc38136ac2dfcd2ce7c139b6099e))
* added modelType to FirestoreDocument ([deecb5d](https://github.com/dereekb/dbx-components/commit/deecb5df415ed9d99412c336ba65f4da572bbe44))
* added OnCallDeleteModel ([358189d](https://github.com/dereekb/dbx-components/commit/358189d6db6ef7d8db93d6dd881d29cc724dd083))
* added OnCallUpdateModel ([3b60a06](https://github.com/dereekb/dbx-components/commit/3b60a06d48ec6a96940f44939e24e5c1f4879aa9))
* added orderByDocumentId, startAtValue, endAtValue constraints ([c846fee](https://github.com/dereekb/dbx-components/commit/c846feef6c26a3818bb006a807b6e931b7b14eaf))


### BREAKING CHANGES

* model type is now required on FirestoreDocument models



# [5.3.0](https://github.com/dereekb/dbx-components/compare/v5.2.1-dev...v5.3.0) (2022-05-30)


### Bug Fixes

* fixed dbxActionEnforceModifiedDirective ([f889b87](https://github.com/dereekb/dbx-components/commit/f889b87463443024c718786e866ad9c9414a3662))
* isIterable and useIterableOrValue treat string as a value ([388d6f0](https://github.com/dereekb/dbx-components/commit/388d6f022cf2937a9883df6a549167340243ac0e))
* setup project scss fix ([9bfb6fd](https://github.com/dereekb/dbx-components/commit/9bfb6fde0443a946804d469b1e916c96f6201136))


### Features

* added authRolesObsWithClaimsService ([10055ae](https://github.com/dereekb/dbx-components/commit/10055ae9f4260211b291419134ba637e9f902893))



## [5.2.1](https://github.com/dereekb/dbx-components/compare/v5.2.0-dev...v5.2.1) (2022-05-29)


### Bug Fixes

* removed angular directives from abstractAsyncWindowLoadedService ([4ab7a74](https://github.com/dereekb/dbx-components/commit/4ab7a740ed1c50965e832f64edc5ce4ee6a60faa))
* setup project template replacement fixes ([fbe36cf](https://github.com/dereekb/dbx-components/commit/fbe36cf89882fcab5bbe77678f72d4e9e4499502))
* setup-project proxy config path fix ([db6c986](https://github.com/dereekb/dbx-components/commit/db6c986065d9852ecd69483a251047fdc87314e7))



# [5.2.0](https://github.com/dereekb/dbx-components/compare/v5.1.0-dev...v5.2.0) (2022-05-29)


### Features

* added collection group support to dbx-firebase components ([9f746c1](https://github.com/dereekb/dbx-components/commit/9f746c12a0e219970dcde12d920f1ef540514ce9))
* added firestore collection group support ([3b4c4cf](https://github.com/dereekb/dbx-components/commit/3b4c4cfa1dd860604c347ade69acdc2fea1063f8))



# [5.1.0](https://github.com/dereekb/dbx-components/compare/v5.0.1-dev...v5.1.0) (2022-05-27)


### Bug Fixes

* added project context to all firebase cli calls ([9b7fd20](https://github.com/dereekb/dbx-components/commit/9b7fd202f12ca303e171657b1d74ec7f4f6c0105))


### Features

* added api proxying and rewrite configuration ([0117dae](https://github.com/dereekb/dbx-components/commit/0117dae50b12a79fa14b4b0219583b2491800bfe))
* added dbxFirebaseAppCheckHttpInterceptor ([96fb516](https://github.com/dereekb/dbx-components/commit/96fb5160a8131d4b13e434bcb3e93819122e1d6f))
* added firebase appCheck support to client ([e9377d1](https://github.com/dereekb/dbx-components/commit/e9377d16faa12a9d45f7a34fda97946b9bf008bd))
* added FirebaseAppCheckMiddleware ([25ddc4e](https://github.com/dereekb/dbx-components/commit/25ddc4e7ae18d6ef96c38ed529c71313884b7544))
* updated .env deployment to demo-api ([d88ea62](https://github.com/dereekb/dbx-components/commit/d88ea620c9593e0073f323f4536bcccd2de01e2f))



## [5.0.1](https://github.com/dereekb/dbx-components/compare/v5.0.0-dev...v5.0.1) (2022-05-26)


### Bug Fixes

* setup-project fixes ([d700370](https://github.com/dereekb/dbx-components/commit/d700370301483b64cf561ab3fe9b0492c697cd45))



# [5.0.0](https://github.com/dereekb/dbx-components/compare/v4.1.0-dev...v5.0.0) (2022-05-25)


### Bug Fixes

* setup-project fixes ([5e174fd](https://github.com/dereekb/dbx-components/commit/5e174fd9b82b4769d5e2d0eac0fe334814a6d26a))


### Code Refactoring

* refactored @dereekb/firebase snapshot field ([c88d278](https://github.com/dereekb/dbx-components/commit/c88d2780d66f965a41ae299e013109f6860e9496))


### Features

* added @dereekb/nestjs/stripe ([455f20e](https://github.com/dereekb/dbx-components/commit/455f20e4e6402b3d517e7857fb93ec82eb25817b))
* added catchAllHandlerKey to handler ([ab93b06](https://github.com/dereekb/dbx-components/commit/ab93b06034dafc27f17cfe3d488ca084b931fabc))
* added clientAppService ([945f388](https://github.com/dereekb/dbx-components/commit/945f388281d4b9295f2820c39a9e7896ebf4d559))
* added firebase functions v2 nest context components ([e5ca892](https://github.com/dereekb/dbx-components/commit/e5ca89250c7b7cf99f75d8edb0fc16a4618cbc21))
* added functionsRegionOrCustomDomain configuration ([e27df0d](https://github.com/dereekb/dbx-components/commit/e27df0dfd8ecf58b7e5f122189d4405f50a7f731))
* added handlerFunction ([7cd2517](https://github.com/dereekb/dbx-components/commit/7cd25174d273f8e501e13ca02607a8c743adb939))
* added nginx docker configuration for webhooks ([9425016](https://github.com/dereekb/dbx-components/commit/9425016eb5d497144d88dccf2a715b795dcc47ae))
* codedError now includes original error if available ([1262281](https://github.com/dereekb/dbx-components/commit/1262281f08b75000f863b483744418378006b2d2))
* improved serve-server ([0e6fb18](https://github.com/dereekb/dbx-components/commit/0e6fb186add4dc003660d4501200de40ca911b20))


### BREAKING CHANGES

* refactored @dereekb/firebase SnapshotConverterFunction and related components and @dereekb/util model conversion components to have better type safety and inference



# [4.1.0](https://github.com/dereekb/dbx-components/compare/v4.0.1-dev...v4.1.0) (2022-05-17)


### Bug Fixes

* fixed package.json exports for util, firebase, and firebase-server ([04c1d9a](https://github.com/dereekb/dbx-components/commit/04c1d9ab56dd2805aac154f7bf139ebca7dc4fb9))


### Features

* setup project ([fe2ae88](https://github.com/dereekb/dbx-components/commit/fe2ae88592c4a02c0346e5e31c72e3d66fb08845))



## [4.0.1](https://github.com/dereekb/dbx-components/compare/v4.0.0-dev...v4.0.1) (2022-05-14)



# [4.0.0](https://github.com/dereekb/dbx-components/compare/v3.0.0...v4.0.0) (2022-05-14)

### Code Refactoring
* break up test exports into individual projects. Now @dereekb/util also exports @dereekb/util/test, @dereekb/firebase exports @dereekb/firebase/test, and @dereekb/firebase-server exports @dereekb/firebase-server/test

# [3.0.0](https://github.com/dereekb/dbx-components/compare/v2.1.0...v3.0.0) (2022-05-13)


### Bug Fixes

* cleanup() now calls the destroy function on complete ([dc8f06b](https://github.com/dereekb/dbx-components/commit/dc8f06b7a5b9f62973356a967867400abb9049e3))
* firebase-tools dependency version bump ([2de0019](https://github.com/dereekb/dbx-components/commit/2de0019986b0d475d3f528f3611b891cbdf757ba))
* fixed createOrUpdateWithAccessor ([243d0d3](https://github.com/dereekb/dbx-components/commit/243d0d3dd83c49171b2f7bea68142c9155f3723d))
* fixed dbxFormlyForm async validation issue ([afb3f96](https://github.com/dereekb/dbx-components/commit/afb3f964564b5b9795071b4f8fcfbaad9f37feec))
* fixed issue with allSuccessfulStates$ in itemAccumulatorInstance ([0396ac5](https://github.com/dereekb/dbx-components/commit/0396ac58fec1a24b703da520063e09c36bbfbf0a))
* itemAccumulatorInstance fix ([d67c9d1](https://github.com/dereekb/dbx-components/commit/d67c9d197934e0c4dee2070a2eea105a7114a56c))
* release fix ([e527980](https://github.com/dereekb/dbx-components/commit/e5279802bf0c35b4f189fdc4489f58014e0864e8))


### Code Refactoring

* renamed conversionFunction to mapFunction ([6aeba77](https://github.com/dereekb/dbx-components/commit/6aeba7721dfd2721d5fe41216a1b81117be80aff))
* renamed value to itemValue in dbxValueListItem ([3441129](https://github.com/dereekb/dbx-components/commit/34411292cf3400fe0aad8872b25d9eba7e4bd062))


### Features

* added AsyncPusher ([8cb2052](https://github.com/dereekb/dbx-components/commit/8cb2052577e0901d2acafa3db724b94ab0035b0a))
* added cleanup() ([1885463](https://github.com/dereekb/dbx-components/commit/18854634041fcdf613ea8f8b0640db9fb218bbce))
* added dbxAppContextState ([dfc17eb](https://github.com/dereekb/dbx-components/commit/dfc17ebfd5281dc0d35b9f5347a1f02d8739c171))
* added dbxAppContextStateModule, dbxAppAuthRouterModule ([40fa1fe](https://github.com/dereekb/dbx-components/commit/40fa1fe9af7ce402e54aac665b9af3c191c9d321))
* added dbxAuthService ([9422182](https://github.com/dereekb/dbx-components/commit/9422182a617d73b4889ce433aa246962739adaf2))
* added dbxCoreAuthModule ([29ebf14](https://github.com/dereekb/dbx-components/commit/29ebf14bc2ce380a7dfafb7d35fd77dfb3d98ea0))
* added dbxFirebaseAuthModule ([3ab16df](https://github.com/dereekb/dbx-components/commit/3ab16dffc5dfcaf0d88755c4b8a8d6a3f8c82c19))
* added dbxFirebaseCollectionChangeDirective ([93a38a2](https://github.com/dereekb/dbx-components/commit/93a38a2be5da3ab5d1bf7905467441fc8b2d563e))
* added dbxFirebaseCollectionStore ([9704c83](https://github.com/dereekb/dbx-components/commit/9704c83603079fe1c58c3961f64d8472ff90bf6d))
* added dbxFirebaseCollectionWithParentStore ([b7045e7](https://github.com/dereekb/dbx-components/commit/b7045e7612326a8fee301a298654f221e3668ab0))
* added dbxFirebaseDocumentStore ([43da785](https://github.com/dereekb/dbx-components/commit/43da785b1b271549f65273a56a0c333a0a23bb2e))
* added dbxFirebaseDocumentWithParentStore ([f055d81](https://github.com/dereekb/dbx-components/commit/f055d81aadc8df852640e7997368af73be05b654))
* added dbxFirebaseFunctionsModule ([3d1bc69](https://github.com/dereekb/dbx-components/commit/3d1bc69552e0a3cede0261d4819ad35199a03fa3))
* added dbxFirebaseLoginModule ([bf99f2d](https://github.com/dereekb/dbx-components/commit/bf99f2d947bedc2305e82e1d8cf0ecc6bb9a1f0f))
* added dbxFirebaseModelLoaderModule ([15a8052](https://github.com/dereekb/dbx-components/commit/15a8052e057fa6e5691915ab81b5fe8b4afdfa95))
* added dbxFormWorkingWrapperComponent ([fd32cd4](https://github.com/dereekb/dbx-components/commit/fd32cd4c2933e79c255f07f86fdc8fc3029b0858))
* added dbxInjectionContext ([a6ac801](https://github.com/dereekb/dbx-components/commit/a6ac80106cd78371391c1a314364997bf974194c))
* added dbxListItemDisableRippleModifier ([c89cc82](https://github.com/dereekb/dbx-components/commit/c89cc82b618ae3513c716d09c1e721b8c32e16c6))
* added dbxListItemModifier, dbxListItemAnchorModifier ([a96ffa8](https://github.com/dereekb/dbx-components/commit/a96ffa8e87b49b4408c917b6480d139dc748d8e4))
* added dbxProgressButtons ([004ada2](https://github.com/dereekb/dbx-components/commit/004ada21ecb9c92325e76222adf8fc6a0762cad4))
* added firebase emulator data importing/exporting for persistence ([8739ba5](https://github.com/dereekb/dbx-components/commit/8739ba5b84881ec1a51bd9034c97d072d17a1828))
* added firebase-server ([676cf9e](https://github.com/dereekb/dbx-components/commit/676cf9e6c44aab5ca993b5a1a9c347c021b41a4a))
* added firebaseQueryItemAccumulator ([1e4e0f3](https://github.com/dereekb/dbx-components/commit/1e4e0f367a4bdc9dac7366ae9421e9ec48279b92))
* added isAllowed ([c2a70bf](https://github.com/dereekb/dbx-components/commit/c2a70bf8a6f4bc4ef8b870691b9899fed3cbafad))
* added IterationQueryChangeWatcher ([f5b2474](https://github.com/dereekb/dbx-components/commit/f5b2474f9a2cf659cdebf19ba49055e5bd2f1c90))
* added jestFunctionFixture ([1ea2d7d](https://github.com/dereekb/dbx-components/commit/1ea2d7d4c852449f34279eeedfadd2d69c1e7f2b))
* added mapKeysIntersection utility functions ([f694f86](https://github.com/dereekb/dbx-components/commit/f694f86b87e646e00e446236bb1c94a28652aa70))
* added modelConversionFunctions ([42050a8](https://github.com/dereekb/dbx-components/commit/42050a8c1561acad97e99d540834d9c1305ca897))
* added modelConversionOptions to modelMapFunction ([2de30e0](https://github.com/dereekb/dbx-components/commit/2de30e07527bbaf27c51a8472054a35e73d2ae2b))
* added modelTestContextFactory ([0a96442](https://github.com/dereekb/dbx-components/commit/0a9644252ffc670cb2e861a4c02ace6790eeae52))
* added onCallWithNestContext to firebase-server ([ad4fcf8](https://github.com/dereekb/dbx-components/commit/ad4fcf80e71e7b954197dd89924d31180c03c911))
* added onMatchDelta ([e36fb4c](https://github.com/dereekb/dbx-components/commit/e36fb4c47c82ef7a616b7d3b12888e370206a2e5))
* added setContainsAllValues ([737c1e7](https://github.com/dereekb/dbx-components/commit/737c1e750a9c656406043e2a69bdceaf941750b6))
* added snapshotConverter, firestoreField ([e986026](https://github.com/dereekb/dbx-components/commit/e986026a4a4700c734fe1534778945df189c518d))
* added transformAndValidateObject ([1f66094](https://github.com/dereekb/dbx-components/commit/1f6609413b85ae1a2b851a70bc2190ff66c7b467))
* dbxSelectionListViewContent can render as dbxListViewContent ([df16297](https://github.com/dereekb/dbx-components/commit/df1629777ec02f3ac96fa0fbcbaa1d4565f7095c))
* firebaseServerAuthModule ([db9a4d3](https://github.com/dereekb/dbx-components/commit/db9a4d3d47fd15317186c7a034c25083ae395251))
* refactored dbxFormSource ([aad115d](https://github.com/dereekb/dbx-components/commit/aad115d9809ed765ddadc63c9f56ac2a4ab5ce5a))


### BREAKING CHANGES

* - renamed flattenIterationResultItemArray to flattenAccumulatorResultItemArray since the input is an accumulator and not an iteration
* renamed value to itemValue to better avoid issues when using DbxValueAsListItem values

- Added DbxValueAsListItem type for those use cases
* renamed dbxInjectedContent to dbxInjection, renamed related content
* renamed ConversionFunction (and related types) to MapFunction



# [2.1.0](https://github.com/dereekb/dbx-components/compare/v2.0.0...v2.1.0) (2022-03-17)


### Bug Fixes

* dbx-web, dbx-form now export scss in package.json ([c7f7c14](https://github.com/dereekb/dbx-components/commit/c7f7c1485aedfe80243c78435d8b39ece60c3a60))
* dbxDateTimeFieldComponent initial date fix ([1704052](https://github.com/dereekb/dbx-components/commit/1704052a31822dc880a03aaf52a4488f58305086))
* updated force-start-release.sh ([3b4da48](https://github.com/dereekb/dbx-components/commit/3b4da487bd58265b67e4ee6b1cda287e076a28a7))


### Features

* date query builder ([9adfe56](https://github.com/dereekb/dbx-components/commit/9adfe56b15ae2ebd1e938ec33d971f410d7ec373))
* dbxActionDialogDirective ([63fb871](https://github.com/dereekb/dbx-components/commit/63fb8717ea1213b602e34640ec1be81d6ca14098))
* dbxActionPopoverDirective ([a808ac9](https://github.com/dereekb/dbx-components/commit/a808ac9a7b62841311d63df1d1ee55e57876f47f))



# [2.0.0](https://github.com/dereekb/dbx-components/compare/v1.2.0...v2.0.0) (2022-03-13)


### Code Refactoring

* **dbx-analytics:** added prefixes to all analytics related classes ([5db960f](https://github.com/dereekb/dbx-components/commit/5db960f0409ff0380b937257b3c9ffc3e9d362d3))


### demo

* added docs page for action context ([a8cbf38](https://github.com/dereekb/dbx-components/commit/a8cbf38c631c4c9f837df274192cbb76f861612c))


### Features

* added dbxActionEnforceModified ([5a4c4b2](https://github.com/dereekb/dbx-components/commit/5a4c4b267f95eda02abccc0fb8a9ae6ab910f738))
* added dbxActionFormDisabledWhileWorking to dbxActionForm ([4d6d67b](https://github.com/dereekb/dbx-components/commit/4d6d67b3b21b57baefa280ad3a72ac2b281e0a19))
* added dbxActionLoadingContextDirective ([c20aa02](https://github.com/dereekb/dbx-components/commit/c20aa0283c6d248e623f32b2026077e854ada090))
* added now to dbxDateTimeFieldComponent ([812e704](https://github.com/dereekb/dbx-components/commit/812e704b9bf44daa7441f236d6fe1e2c499ec7dd))
* added setContainsAnyValue() ([ea0ee9a](https://github.com/dereekb/dbx-components/commit/ea0ee9a76fc6b093b2608356179e9f633fc896be))


### BREAKING CHANGES

* Renamed DbxActionState SUCCESS state to RESOLVED
* **dbx-analytics:** Added dbx prefix to all analytics items to keep consistency



# [1.2.0](https://github.com/dereekb/dbx-components/compare/v1.1.0...v1.2.0) (2022-03-04)


### Features

* added setContainsAnyValue() ([ea0ee9a](https://github.com/dereekb/dbx-components/commit/ea0ee9a76fc6b093b2608356179e9f633fc896be))



# [1.1.0](https://github.com/dereekb/dbx-components/compare/v1.0.0...v1.1.0) (2022-03-02)


### Bug Fixes

* added reports to gitignore ([ae17ba7](https://github.com/dereekb/dbx-components/commit/ae17ba730bd7c95e8e320a389243998aa5fee9c4))
* build fixes in components ([6c06411](https://github.com/dereekb/dbx-components/commit/6c06411a0646ffbdb7e2d15398ad481f408ec1a4))
* dbx-analytics build fix ([fdd142c](https://github.com/dereekb/dbx-components/commit/fdd142c9c206d9fc662f8452a532820f313426da))
* dbx-core build fix ([471c71d](https://github.com/dereekb/dbx-components/commit/471c71d5b8621534dfc4017737cffe66e35fe547))
* dbx-core build fix (Checkpoint) ([f9b69bf](https://github.com/dereekb/dbx-components/commit/f9b69bf408d6a1b14a00fe3bcee6b7e1d26b9b83))
* docker port forwarding with ./serve.sh ([92e147b](https://github.com/dereekb/dbx-components/commit/92e147bdb58a9f7d10115913e1945efc804a67fc))
* firebase git ignore ([6be0e63](https://github.com/dereekb/dbx-components/commit/6be0e63a402d31cd36fab4bbc0c9a764b5dbe1d8))
* import fixes ([77c1f7e](https://github.com/dereekb/dbx-components/commit/77c1f7ebf2b80353f26aefec04a541c0fc4af622))
* iteration ([e3ae126](https://github.com/dereekb/dbx-components/commit/e3ae126b970b0d012b4581ad272e1f601e3ab1bc))


### Features

* accumulator with mapping ([6afb408](https://github.com/dereekb/dbx-components/commit/6afb4083a9339ae2aa3aac7a536ee383d0aa77b8))
* added dbx-analytics ([33fb9f4](https://github.com/dereekb/dbx-components/commit/33fb9f43406d36acfb50be04e35a0f0a9f8b973e))
* added env files ([bc0acbb](https://github.com/dereekb/dbx-components/commit/bc0acbb615c03ab3d9ae0d57b67d0b865c959b23))
* added firebase package ([9a80d69](https://github.com/dereekb/dbx-components/commit/9a80d69abd0cb0a67888554d388a4f1f393bdc78))
* added flattenIterationResultItemArray ([f3220c7](https://github.com/dereekb/dbx-components/commit/f3220c7f2e7452a67ae95e7ce272c3dd9bbdc937))
* added iteration accumulator ([aaf0390](https://github.com/dereekb/dbx-components/commit/aaf039058c9366db44182d9da6bc05617d91015b))
* angular app ([76f96a7](https://github.com/dereekb/dbx-components/commit/76f96a7cdfc67127c619a08e9d246e44ff15b780))
* dbNgxFirestoreCollection ([62a3586](https://github.com/dereekb/dbx-components/commit/62a3586bb49ad36614ee2812047533749fcd6ace))
* demo-api ([5e3c81c](https://github.com/dereekb/dbx-components/commit/5e3c81cabbdfcfe27fec2dee6ca35ad465ab76d6))
* deploy ([30a654c](https://github.com/dereekb/dbx-components/commit/30a654c304c9e77fc6789f99437a365d2d4edbfa))
* docker cache (Checkpoint) ([84bd6cb](https://github.com/dereekb/dbx-components/commit/84bd6cba1040ffde6e37cc19d81217c52e3252c2))
* firebase ([558ff2c](https://github.com/dereekb/dbx-components/commit/558ff2c906bff7e83fecf8332c61a5c7a0bb57d8))
* firebase config and emulators ([a0fae3d](https://github.com/dereekb/dbx-components/commit/a0fae3df9f3710206aa9752c6412fe688c3c0299))
* firebase iterator ([8db29b3](https://github.com/dereekb/dbx-components/commit/8db29b3cc8ad64a6a98e7f4f290b37adfad02bd6))
* firestore iterator ([549466e](https://github.com/dereekb/dbx-components/commit/549466e167085f43dfcf72623270dcdb7f39a684))
* itemPageIteratorIterationInstance ([1d1d001](https://github.com/dereekb/dbx-components/commit/1d1d00100916c209abe870f9d7aa25e11ba487db))
* iteration mapped ([ddf8235](https://github.com/dereekb/dbx-components/commit/ddf82356f612047829640ba9bd09fd81432085e5))
* nextPage returns a promise ([ac4fd34](https://github.com/dereekb/dbx-components/commit/ac4fd342c51baa73b847b80fb52b6e38b0f5923a))
* pageLoadingState ([1a5851d](https://github.com/dereekb/dbx-components/commit/1a5851d689b980fff9db3bd592e465e22d54c612))
* test utilities ([f21f421](https://github.com/dereekb/dbx-components/commit/f21f42187b594046138bc904495393b508a0dc45))
* upgraded dbx loading components and tests ([797d576](https://github.com/dereekb/dbx-components/commit/797d576648aa76f34250303df37cee83689fc391))



# 1.0.0 (2022-02-23)


### Bug Fixes

* added reports to gitignore ([ae17ba7](https://github.com/dereekb/dbx-components/commit/ae17ba730bd7c95e8e320a389243998aa5fee9c4))
* build fixes in components ([6c06411](https://github.com/dereekb/dbx-components/commit/6c06411a0646ffbdb7e2d15398ad481f408ec1a4))
* dbx-analytics build fix ([fdd142c](https://github.com/dereekb/dbx-components/commit/fdd142c9c206d9fc662f8452a532820f313426da))
* dbx-core build fix ([471c71d](https://github.com/dereekb/dbx-components/commit/471c71d5b8621534dfc4017737cffe66e35fe547))
* dbx-core build fix (Checkpoint) ([f9b69bf](https://github.com/dereekb/dbx-components/commit/f9b69bf408d6a1b14a00fe3bcee6b7e1d26b9b83))
* docker port forwarding with ./serve.sh ([92e147b](https://github.com/dereekb/dbx-components/commit/92e147bdb58a9f7d10115913e1945efc804a67fc))
* firebase git ignore ([6be0e63](https://github.com/dereekb/dbx-components/commit/6be0e63a402d31cd36fab4bbc0c9a764b5dbe1d8))
* import fixes ([77c1f7e](https://github.com/dereekb/dbx-components/commit/77c1f7ebf2b80353f26aefec04a541c0fc4af622))
* iteration ([e3ae126](https://github.com/dereekb/dbx-components/commit/e3ae126b970b0d012b4581ad272e1f601e3ab1bc))
* removed browserModule imports from dbx-web ([84cbdf2](https://github.com/dereekb/dbx-components/commit/84cbdf26bab41a7c4fc964ca3b74dcf093726a74))
* renamed field ([7172901](https://github.com/dereekb/dbx-components/commit/71729011e15ee19410d7b9529696e08b18a9fbde))


### Code Refactoring

* renamed dbNgx prefix to dbx ([a545a76](https://github.com/dereekb/dbx-components/commit/a545a76ed9300b594a3aafe4d89902d18c9d5e3d))


### Features

* accumulator with mapping ([6afb408](https://github.com/dereekb/dbx-components/commit/6afb4083a9339ae2aa3aac7a536ee383d0aa77b8))
* added dbx-analytics ([33fb9f4](https://github.com/dereekb/dbx-components/commit/33fb9f43406d36acfb50be04e35a0f0a9f8b973e))
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
* added env files ([bc0acbb](https://github.com/dereekb/dbx-components/commit/bc0acbb615c03ab3d9ae0d57b67d0b865c959b23))
* added FilterMap ([6ffefce](https://github.com/dereekb/dbx-components/commit/6ffefce8e13efd36adb79ea6f95fb0edafe22f16))
* added firebase package ([9a80d69](https://github.com/dereekb/dbx-components/commit/9a80d69abd0cb0a67888554d388a4f1f393bdc78))
* added flattenIterationResultItemArray ([f3220c7](https://github.com/dereekb/dbx-components/commit/f3220c7f2e7452a67ae95e7ce272c3dd9bbdc937))
* added iteration accumulator ([aaf0390](https://github.com/dereekb/dbx-components/commit/aaf039058c9366db44182d9da6bc05617d91015b))
* added makeBestFit() ([b0cf900](https://github.com/dereekb/dbx-components/commit/b0cf900247ab0490fcb35f845cefecc82e45332b))
* added tapLog() ([1d2fd64](https://github.com/dereekb/dbx-components/commit/1d2fd640b7b87052dd006697fab71a5adf7701da))
* added treeNode ([1aa120f](https://github.com/dereekb/dbx-components/commit/1aa120f7f8c83ccc46d440b77fbd234dec564aea))
* added vh100 functionality ([10b86b4](https://github.com/dereekb/dbx-components/commit/10b86b42fb6653c338212b32d7f3555109747787))
* angular app ([76f96a7](https://github.com/dereekb/dbx-components/commit/76f96a7cdfc67127c619a08e9d246e44ff15b780))
* dbNgxFirestoreCollection ([62a3586](https://github.com/dereekb/dbx-components/commit/62a3586bb49ad36614ee2812047533749fcd6ace))
* demo-api ([5e3c81c](https://github.com/dereekb/dbx-components/commit/5e3c81cabbdfcfe27fec2dee6ca35ad465ab76d6))
* deploy ([30a654c](https://github.com/dereekb/dbx-components/commit/30a654c304c9e77fc6789f99437a365d2d4edbfa))
* docker cache (Checkpoint) ([84bd6cb](https://github.com/dereekb/dbx-components/commit/84bd6cba1040ffde6e37cc19d81217c52e3252c2))
* firebase ([558ff2c](https://github.com/dereekb/dbx-components/commit/558ff2c906bff7e83fecf8332c61a5c7a0bb57d8))
* firebase config and emulators ([a0fae3d](https://github.com/dereekb/dbx-components/commit/a0fae3df9f3710206aa9752c6412fe688c3c0299))
* firebase iterator ([8db29b3](https://github.com/dereekb/dbx-components/commit/8db29b3cc8ad64a6a98e7f4f290b37adfad02bd6))
* firestore iterator ([549466e](https://github.com/dereekb/dbx-components/commit/549466e167085f43dfcf72623270dcdb7f39a684))
* itemPageIteratorIterationInstance ([1d1d001](https://github.com/dereekb/dbx-components/commit/1d1d00100916c209abe870f9d7aa25e11ba487db))
* iteration mapped ([ddf8235](https://github.com/dereekb/dbx-components/commit/ddf82356f612047829640ba9bd09fd81432085e5))
* nextPage returns a promise ([ac4fd34](https://github.com/dereekb/dbx-components/commit/ac4fd342c51baa73b847b80fb52b6e38b0f5923a))
* pageLoadingState ([1a5851d](https://github.com/dereekb/dbx-components/commit/1a5851d689b980fff9db3bd592e465e22d54c612))
* segment analytics ([b81d5a6](https://github.com/dereekb/dbx-components/commit/b81d5a6a70ecf3bc35852d441cfd79e91e5dcb51))
* test utilities ([f21f421](https://github.com/dereekb/dbx-components/commit/f21f42187b594046138bc904495393b508a0dc45))
* upgraded dbx loading components and tests ([797d576](https://github.com/dereekb/dbx-components/commit/797d576648aa76f34250303df37cee83689fc391))


### BREAKING CHANGES

* all services now have the prefix Dbx instead of DbNgx



# 0.1.0 (2022-01-29)


### Bug Fixes

* added reports to gitignore ([ae17ba7](https://github.com/dereekb/dbx-components/commit/ae17ba730bd7c95e8e320a389243998aa5fee9c4))
* build fixes in components ([6c06411](https://github.com/dereekb/dbx-components/commit/6c06411a0646ffbdb7e2d15398ad481f408ec1a4))
* dbx-analytics build fix ([fdd142c](https://github.com/dereekb/dbx-components/commit/fdd142c9c206d9fc662f8452a532820f313426da))
* dbx-core build fix ([471c71d](https://github.com/dereekb/dbx-components/commit/471c71d5b8621534dfc4017737cffe66e35fe547))
* dbx-core build fix (Checkpoint) ([f9b69bf](https://github.com/dereekb/dbx-components/commit/f9b69bf408d6a1b14a00fe3bcee6b7e1d26b9b83))
* docker port forwarding with ./serve.sh ([92e147b](https://github.com/dereekb/dbx-components/commit/92e147bdb58a9f7d10115913e1945efc804a67fc))
* firebase git ignore ([6be0e63](https://github.com/dereekb/dbx-components/commit/6be0e63a402d31cd36fab4bbc0c9a764b5dbe1d8))
* import fixes ([77c1f7e](https://github.com/dereekb/dbx-components/commit/77c1f7ebf2b80353f26aefec04a541c0fc4af622))
* iteration ([e3ae126](https://github.com/dereekb/dbx-components/commit/e3ae126b970b0d012b4581ad272e1f601e3ab1bc))


### Features

* accumulator with mapping ([6afb408](https://github.com/dereekb/dbx-components/commit/6afb4083a9339ae2aa3aac7a536ee383d0aa77b8))
* added dbx-analytics ([33fb9f4](https://github.com/dereekb/dbx-components/commit/33fb9f43406d36acfb50be04e35a0f0a9f8b973e))
* added env files ([bc0acbb](https://github.com/dereekb/dbx-components/commit/bc0acbb615c03ab3d9ae0d57b67d0b865c959b23))
* added firebase package ([9a80d69](https://github.com/dereekb/dbx-components/commit/9a80d69abd0cb0a67888554d388a4f1f393bdc78))
* added flattenIterationResultItemArray ([f3220c7](https://github.com/dereekb/dbx-components/commit/f3220c7f2e7452a67ae95e7ce272c3dd9bbdc937))
* added iteration accumulator ([aaf0390](https://github.com/dereekb/dbx-components/commit/aaf039058c9366db44182d9da6bc05617d91015b))
* angular app ([76f96a7](https://github.com/dereekb/dbx-components/commit/76f96a7cdfc67127c619a08e9d246e44ff15b780))
* dbNgxFirestoreCollection ([62a3586](https://github.com/dereekb/dbx-components/commit/62a3586bb49ad36614ee2812047533749fcd6ace))
* demo-api ([5e3c81c](https://github.com/dereekb/dbx-components/commit/5e3c81cabbdfcfe27fec2dee6ca35ad465ab76d6))
* deploy ([30a654c](https://github.com/dereekb/dbx-components/commit/30a654c304c9e77fc6789f99437a365d2d4edbfa))
* docker cache (Checkpoint) ([84bd6cb](https://github.com/dereekb/dbx-components/commit/84bd6cba1040ffde6e37cc19d81217c52e3252c2))
* firebase ([558ff2c](https://github.com/dereekb/dbx-components/commit/558ff2c906bff7e83fecf8332c61a5c7a0bb57d8))
* firebase config and emulators ([a0fae3d](https://github.com/dereekb/dbx-components/commit/a0fae3df9f3710206aa9752c6412fe688c3c0299))
* firebase iterator ([8db29b3](https://github.com/dereekb/dbx-components/commit/8db29b3cc8ad64a6a98e7f4f290b37adfad02bd6))
* firestore iterator ([549466e](https://github.com/dereekb/dbx-components/commit/549466e167085f43dfcf72623270dcdb7f39a684))
* itemPageIteratorIterationInstance ([1d1d001](https://github.com/dereekb/dbx-components/commit/1d1d00100916c209abe870f9d7aa25e11ba487db))
* iteration mapped ([ddf8235](https://github.com/dereekb/dbx-components/commit/ddf82356f612047829640ba9bd09fd81432085e5))
* nextPage returns a promise ([ac4fd34](https://github.com/dereekb/dbx-components/commit/ac4fd342c51baa73b847b80fb52b6e38b0f5923a))
* pageLoadingState ([1a5851d](https://github.com/dereekb/dbx-components/commit/1a5851d689b980fff9db3bd592e465e22d54c612))
* test utilities ([f21f421](https://github.com/dereekb/dbx-components/commit/f21f42187b594046138bc904495393b508a0dc45))
* upgraded dbx loading components and tests ([797d576](https://github.com/dereekb/dbx-components/commit/797d576648aa76f34250303df37cee83689fc391))
