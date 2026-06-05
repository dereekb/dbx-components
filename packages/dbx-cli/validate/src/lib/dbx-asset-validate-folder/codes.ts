/**
 * Violation codes emitted by `dbx_asset_validate_folder`.
 *
 * The folder-level checks focus on the component side: the
 * `assets.ts` file presence, its parse-ability, and its barrel
 * re-export. Cross-app wiring (provider, local file existence) is
 * verified by `dbx_asset_validate_app`.
 */
export enum DbxAssetValidateFolderCode {
  /**
   * The component package root does not exist or is not a directory.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `componentDir` does not resolve to an existing directory.
   * @dbxRuleNotApplies Validating an app that doesn't ship its own component package.
   * @dbxRuleFix Pass a `componentDir` that points at a real `-firebase` component package.
   * @dbxRuleSeeAlso tool:dbx_asset_validate_app
   */
  DBX_ASSET_FOLDER_COMPONENT_DIR_NOT_FOUND = 'DBX_ASSET_FOLDER_COMPONENT_DIR_NOT_FOUND',

  /**
   * The component does not contain a `src/lib/assets.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `-firebase` component package that should expose an `AssetPathRef` catalog.
   * @dbxRuleNotApplies Components that intentionally don't ship asset refs.
   * @dbxRuleFix Add `<componentDir>/src/lib/assets.ts` exporting `AssetPathRef` constants.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_FOLDER_FILE_MISSING = 'DBX_ASSET_FOLDER_FILE_MISSING',

  /**
   * `assets.ts` exports neither an `AssetPathRef` constant nor an
   * `AssetPathRef[]` aggregator.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Components whose `assets.ts` parses but exports no asset refs.
   * @dbxRuleNotApplies Empty placeholders awaiting first-use scaffolding.
   * @dbxRuleFix Use `dbx_asset_scaffold` to add a first ref and aggregator.
   * @dbxRuleSeeAlso tool:dbx_asset_scaffold
   */
  DBX_ASSET_FOLDER_NO_EXPORTS = 'DBX_ASSET_FOLDER_NO_EXPORTS',

  /**
   * The component's barrel `src/lib/index.ts` does not re-export `./assets`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Components whose `src/lib/assets.ts` exists but isn't re-exported through the package barrel.
   * @dbxRuleNotApplies Components that intentionally hide their asset refs from downstream consumers.
   * @dbxRuleFix Add `export * from './assets';` to `<componentDir>/src/lib/index.ts`.
   * @dbxRuleSeeAlso skill:dbx__guide__asset-setup
   */
  DBX_ASSET_FOLDER_BARREL_MISSING = 'DBX_ASSET_FOLDER_BARREL_MISSING'
}

/**
 * String-literal union derived from {@link DbxAssetValidateFolderCode}.
 */
export type DbxAssetValidateFolderCodeString = `${DbxAssetValidateFolderCode}`;
