## Migration of v9.x.x to v10.x.x
Migration/Upgrade info is available in the `setup/v9-to-v10-upgrade-info.md` document.

## Migration of v10.x.x to v11.x.x
### Overview
Version 10 to 11 stays on Angular 16, but updates the build target to ES2022. The change to ES2022 brought about some breaking changes with regards to the implicit "useDefineForClassFields" usage. We decided to just update the entire project to use Angular's inject() and replaced some classes with their pojo/functional equivalent and now force "useDefineForClassFields"=true for all builds.

Some related threads to the useDefineForClassFields usage:
- https://github.com/microsoft/TypeScript/issues/52331
- https://github.com/microsoft/vscode/issues/186726
- https://github.com/ngrx/platform/issues/3654

### Breaking Changes
- `tsconfig.base.json` now targets `ES2022`
- `tsconfig.base.json` now has the configuration `"useDefineForClassFields"=true`, which explicitly declares useDefineForClassFields
- All dbx-components Angular components and directives were update to use Angular's `inject()` functionality and reduced dependency on constructor injection.
- The `AbstractSubscriptionDirective` had the constructor removed. Update any subclasses.
- Many dbx-component classes had their constructor removed where only items were being injected. Child classes no longer need to pass those constructors, so update those classes.
- Updated various LoadingState related functions. A compatability of all the prior functions is available for v11.
- `DbxRouteParamReaderInstance` is now an interface. The getter/setter is replaced with methods.
- `DbxFirebaseIdRouteParamRedirectInstance` is now an interface. The getter/setter is replaced with methods.
- The `DbxTextCompatModule` has been added to include a number of deprecated components that were removed from `DbxTextModule`.
- Renamed `AbstractDbxPresetFilterMenuComponent` to `AbstractDbxPresetFilterMenuDirective`
- Removed deprecated type `HandleActionWithFunctionOrContext` and related deprecated types
- Removed deprecated function `modelFirebaseFunctionMapFactory()`
- Removed deperecated type `FirestoreStringTransformOption` and other deprecated firestore snapshot-type functions
- Removed deprecated string `CREATE_MODEL_APP_FUNCTION_KEY` and related strings
- Removed mergeIntoArray and related types
- Renamed `DbxFormExpandWrapperComponent` and related values. The function was always `expandWrapper()` so this change most likely causes no issues.
- Removed `ZohoRecruitModule` and replaced it will `appZohoRecruitModuleMetadata()`
- Most `PageItemIteration` and related implementations are now functional. `maxPageLoadLimit` is now split into a getter and setter function, instead of a get/set on the variable.
- `MappedItemIterationInstance` and related types are now interfaces with functional implementations. 
- `BooleanKeyArrayUtilityInstance` was removed and replaced with a functional implementation, `booleanKeyArrayUtility`. The `BooleanStringKeyArrayUtility` is now deprecated.
- `DbxAnalyticsStreamEventAnalyticsEventWrapper` is now an interface
- 