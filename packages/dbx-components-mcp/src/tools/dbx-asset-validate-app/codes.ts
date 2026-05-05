/**
 * Violation codes emitted by `dbx_asset_validate_app`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 */
export enum DbxAssetValidateAppCode {
  /**
   * The component package root does not exist or is not a directory.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `componentDir` does not resolve to an existing directory.
   * @dbxRuleNotApplies Components that intentionally don't ship asset refs — pass `--skip asset` to `dbx_app_validate` instead.
   * @dbxRuleFix Pass a `componentDir` that points at a real `-firebase` component package (e.g. `components/demo-firebase`).
   * @dbxRuleSeeAlso tool:dbx_asset_validate_folder
   */
  DBX_ASSET_COMPONENT_DIR_NOT_FOUND = 'DBX_ASSET_COMPONENT_DIR_NOT_FOUND',

  /**
   * The Angular app root does not exist or is not a directory.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `apiDir` does not resolve to an existing directory.
   * @dbxRuleNotApplies Backends that don't host an Angular front-end — the asset validator targets the Angular wiring.
   * @dbxRuleFix Pass an `apiDir` that points at the Angular app (e.g. `apps/demo`), not the API app.
   * @dbxRuleSeeAlso tool:dbx_asset_validate_folder
   */
  DBX_ASSET_APP_DIR_NOT_FOUND = 'DBX_ASSET_APP_DIR_NOT_FOUND',

  /**
   * The component does not contain a `src/lib/assets.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `-firebase` component package that should expose an `AssetPathRef` catalog.
   * @dbxRuleNotApplies Components that intentionally don't ship local asset refs.
   * @dbxRuleFix Add `<componentDir>/src/lib/assets.ts` exporting `AssetPathRef` constants and an `AssetPathRef[]` aggregator.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_FILE_MISSING = 'DBX_ASSET_FILE_MISSING',

  /**
   * The component's barrel `src/lib/index.ts` does not re-export `./assets`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Components whose `src/lib/assets.ts` exists but is not re-exported through the package barrel.
   * @dbxRuleNotApplies Components that intentionally hide their asset refs from downstream consumers.
   * @dbxRuleFix Add `export * from './assets';` to `<componentDir>/src/lib/index.ts`.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_BARREL_MISSING = 'DBX_ASSET_BARREL_MISSING',

  /**
   * `assets.ts` declares no exported `AssetPathRef[]` aggregator constant.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Components whose `assets.ts` file exists and parses but has no `: AssetPathRef[]`-annotated export.
   * @dbxRuleNotApplies Components that only need a single ref and intentionally omit the aggregator (rare — most apps want a discoverable list).
   * @dbxRuleFix Add `export const <PROJECT>_ASSETS: AssetPathRef[] = [...];` listing every exported ref.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_NO_AGGREGATOR = 'DBX_ASSET_NO_AGGREGATOR',

  /**
   * The aggregator array references an identifier that is not a declared
   * `AssetPathRef` constant in the file (and is not a trust-listed external).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every aggregator member that does not match a local export.
   * @dbxRuleNotApplies Identifiers imported from a trust-listed `@dereekb/*` module.
   * @dbxRuleFix Either declare the missing `export const <NAME> = ...` or remove the entry from the aggregator.
   */
  DBX_ASSET_AGGREGATOR_MISSING_MEMBER = 'DBX_ASSET_AGGREGATOR_MISSING_MEMBER',

  /**
   * An exported asset constant uses a builder callee that is not one of the
   * four known `@dereekb/rxjs` builders.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `export const X = <callee>(...)` whose callee is not `localAsset` / `remoteAsset` / `assetFolder` / `remoteAssetBaseUrl` and not a trusted external.
   * @dbxRuleNotApplies Builders re-exported from a trust-listed `@dereekb/*` module — those go through the trust list.
   * @dbxRuleFix Use one of `localAsset`, `remoteAsset`, `assetFolder('foo').asset('bar')`, or `remoteAssetBaseUrl('https://...').asset('x')` from `@dereekb/rxjs`.
   */
  DBX_ASSET_BUILDER_UNKNOWN = 'DBX_ASSET_BUILDER_UNKNOWN',

  /**
   * A local asset constant resolves to a path that does not exist under
   * `<appDir>/src/assets/`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `localAsset(path)` / `assetFolder('folder').asset('file')` reference whose joined path has no matching file under the Angular app's `src/assets/` directory.
   * @dbxRuleNotApplies Custom `localBaseUrl` configurations passed to `provideDbxAssetLoader` — only the default `/assets/` base is checked.
   * @dbxRuleFix Place the file at `<appDir>/src/assets/<path>` so Angular CLI copies it to the build output.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_LOCAL_FILE_MISSING = 'DBX_ASSET_LOCAL_FILE_MISSING',

  /**
   * A `remoteAsset(...)` or `remoteAssetBaseUrl(...)` argument is not an
   * absolute http/https URL.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every remote-builder argument that is a string literal but lacks an `http://` or `https://` prefix.
   * @dbxRuleNotApplies Arguments built from variables, template strings, or environment values — those cannot be statically validated.
   * @dbxRuleFix Use a literal absolute URL (e.g. `'https://cdn.example.com/data.json'`).
   */
  DBX_ASSET_REMOTE_INVALID_URL = 'DBX_ASSET_REMOTE_INVALID_URL',

  /**
   * The Angular app config does not call `provideDbxAssetLoader(`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every Angular app whose `src/root.app.config.ts` should register the asset loader provider.
   * @dbxRuleNotApplies Apps that wire the loader from a non-standard config file — extend the scanner if so.
   * @dbxRuleFix Add `provideDbxAssetLoader()` (from `@dereekb/dbx-core`) to the providers array in `<appDir>/src/root.app.config.ts`.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_PROVIDER_MISSING = 'DBX_ASSET_PROVIDER_MISSING',

  /**
   * `provideDbxAssetLoader` is invoked but not imported from `@dereekb/dbx-core`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the call site exists but the import statement does not name `provideDbxAssetLoader` from `@dereekb/dbx-core`.
   * @dbxRuleNotApplies Re-exports from a workspace-local barrel that proxies `@dereekb/dbx-core` — but those defeat tree-shaking and are discouraged.
   * @dbxRuleFix Import `provideDbxAssetLoader` directly from `@dereekb/dbx-core`.
   */
  DBX_ASSET_PROVIDER_IMPORT_MISSING = 'DBX_ASSET_PROVIDER_IMPORT_MISSING',

  /**
   * Two exported `AssetPathRef` constants resolve to the same path or URL.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one constant produces the same `path` (local) or `url` (remote).
   * @dbxRuleNotApplies Constants intentionally aliased — but this defeats discriminating refs by symbol, so almost always a copy-paste.
   * @dbxRuleFix Choose distinct paths/URLs or fold the duplicates into a single export.
   */
  DBX_ASSET_DUPLICATE_PATH = 'DBX_ASSET_DUPLICATE_PATH'
}

/**
 * String-literal union derived from {@link DbxAssetValidateAppCode}.
 */
export type DbxAssetValidateAppCodeString = `${DbxAssetValidateAppCode}`;
