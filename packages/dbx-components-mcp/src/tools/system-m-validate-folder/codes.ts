/**
 * Violation codes emitted by `dbx_system_m_validate_folder`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * The system folder validator runs on a downstream `system/` model
 * folder and verifies layout (`system.ts` + `index.ts`, no
 * disallowed `system.id.ts` / `system.query.ts`) and content
 * pairing (every `<NAME>_SYSTEM_STATE_TYPE` constant has a
 * matching `<Foo>SystemData` interface, a `<foo>SystemDataConverter`
 * config, and is referenced by the aggregate
 * `<app>SystemStateStoredDataConverterMap`).
 */
export enum SystemMValidateFolderCode {
  /**
   * The supplied path does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the folder path argument does not resolve to an entry.
   * @dbxRuleNotApplies Glob patterns intentionally matching zero folders — pass at least one valid path.
   * @dbxRuleFix Verify the path resolves to an existing system model folder under the workspace.
   */
  SYSTEM_FOLDER_NOT_FOUND = 'SYSTEM_FOLDER_NOT_FOUND',

  /**
   * The supplied path resolves to a file or other non-directory entry.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the path exists but is not a directory.
   * @dbxRuleNotApplies File-level system validation — pass the folder, not `system.ts`.
   * @dbxRuleFix Pass the system folder (e.g. `apps/.../src/lib/model/system/`), not the `system.ts` file inside it.
   */
  SYSTEM_FOLDER_NOT_DIRECTORY = 'SYSTEM_FOLDER_NOT_DIRECTORY',

  /**
   * Required `system.ts` main module is missing from the system folder.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every system folder that resolves to an existing directory.
   * @dbxRuleNotApplies The base `@dereekb/firebase` system folder — that ships machinery (`systemStateIdentity` etc.) and should not be validated with this tool.
   * @dbxRuleFix Add `system.ts` declaring the downstream `<NAME>_SYSTEM_STATE_TYPE` constants, `<Foo>SystemData` interfaces, converters, and the aggregate `<app>SystemStateStoredDataConverterMap`.
   * @dbxRuleSeeAlso doc:dbx__ref__system-state
   */
  SYSTEM_FOLDER_MISSING_MAIN = 'SYSTEM_FOLDER_MISSING_MAIN',

  /**
   * Required `index.ts` barrel is missing from the system folder.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every system folder that resolves to an existing directory.
   * @dbxRuleNotApplies The base `@dereekb/firebase` system folder — covered above.
   * @dbxRuleFix Add `index.ts` re-exporting `system.ts` (and any optional siblings) so the folder is consumed through one barrel.
   */
  SYSTEM_FOLDER_MISSING_INDEX = 'SYSTEM_FOLDER_MISSING_INDEX',

  /**
   * A file disallowed at the system folder root is present (`system.id.ts` or `system.query.ts`).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the folder contains `system.id.ts` (SystemState identifiers are plain string keys) or `system.query.ts` (documents are fetched by key, not queried).
   * @dbxRuleNotApplies No known false-positive cases — the listed files conflict with the SystemState convention.
   * @dbxRuleFix Delete the disallowed file. The reason is included in the violation message.
   */
  SYSTEM_FOLDER_DISALLOWED_FILE = 'SYSTEM_FOLDER_DISALLOWED_FILE',

  /**
   * A `.ts` file in the system folder doesn't follow the `system.<sub>.ts` convention.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any `.ts` file other than `index.ts` whose basename doesn't start with `system.`.
   * @dbxRuleNotApplies Files outside the canonical layout that the project intentionally hosts here (rare — prefer moving them out).
   * @dbxRuleFix Rename the file to `system.<sub>.ts`, or move it out of the system folder.
   */
  SYSTEM_FOLDER_STRAY_FILE = 'SYSTEM_FOLDER_STRAY_FILE',

  /**
   * `system.ts` declares state-type triples but no aggregate `<app>SystemStateStoredDataConverterMap` is exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `system.ts` contains at least one `<NAME>_SYSTEM_STATE_TYPE` / `<Foo>SystemData` / `<foo>SystemDataConverter` triple.
   * @dbxRuleNotApplies `system.ts` files that declare zero triples (an empty downstream system folder is still valid as long as `system.ts` exists).
   * @dbxRuleFix Add `export const <app>SystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = { ... }` mapping each `<NAME>_SYSTEM_STATE_TYPE` to its converter.
   * @dbxRuleSeeAlso doc:dbx__ref__system-state
   */
  SYSTEM_MISSING_CONVERTER_MAP = 'SYSTEM_MISSING_CONVERTER_MAP',

  /**
   * A declared `<NAME>_SYSTEM_STATE_TYPE` constant is not referenced by the aggregate converter map.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every state-type constant declared in `system.ts`.
   * @dbxRuleNotApplies State types provided by upstream packages (the validator only reports locally declared constants).
   * @dbxRuleFix Add the constant as a key on `<app>SystemStateStoredDataConverterMap` so the runtime knows which converter to use.
   */
  SYSTEM_TYPE_NOT_IN_MAP = 'SYSTEM_TYPE_NOT_IN_MAP',

  /**
   * A `<NAME>_SYSTEM_STATE_TYPE` / `<Foo>SystemData` pair has no matching `<foo>SystemDataConverter`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every state-type constant whose name normalizes to a `<Foo>SystemData` interface but no `<foo>SystemDataConverter` constant exists.
   * @dbxRuleNotApplies Converters provided by an upstream package and re-exported through `system.ts` (rare — usually a missed scaffold step).
   * @dbxRuleFix Add `export const <foo>SystemDataConverter: SystemStateStoredDataFieldConverterConfig<<Foo>SystemData> = { ... }` adjacent to the interface.
   * @dbxRuleSeeAlso doc:dbx__ref__system-state
   */
  SYSTEM_MISSING_CONVERTER = 'SYSTEM_MISSING_CONVERTER',

  /**
   * A `<Foo>SystemData` interface has no matching `<NAME>_SYSTEM_STATE_TYPE` constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<Foo>SystemData` interface declared in `system.ts`.
   * @dbxRuleNotApplies Interfaces provided by an upstream package and re-exported here (rare — usually a missed scaffold step).
   * @dbxRuleFix Add `export const <NAME>_SYSTEM_STATE_TYPE: SystemStateType = '<value>'` adjacent to the interface.
   */
  SYSTEM_MISSING_TYPE_CONSTANT = 'SYSTEM_MISSING_TYPE_CONSTANT',

  /**
   * A `<Foo>SystemData` interface exists but no matching `<NAME>_SYSTEM_STATE_TYPE` constant — pair is orphaned.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `<Foo>SystemData` is declared without a same-prefix state-type constant.
   * @dbxRuleNotApplies The interface is intentionally re-exported from another package (rare — usually a typo or rename drift).
   * @dbxRuleFix Either declare the matching `<NAME>_SYSTEM_STATE_TYPE` constant or rename the interface so it pairs with an existing constant.
   */
  SYSTEM_ORPHAN_TYPE_CONSTANT = 'SYSTEM_ORPHAN_TYPE_CONSTANT',

  /**
   * A `<foo>SystemDataConverter` exists with no matching `<Foo>SystemData` interface or `<NAME>_SYSTEM_STATE_TYPE` constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the converter's prefix has no sibling interface + constant.
   * @dbxRuleNotApplies The converter is intentionally re-exported from another package (rare — usually a typo or rename drift).
   * @dbxRuleFix Either declare the matching interface + constant pair or rename the converter so it pairs with an existing triple.
   */
  SYSTEM_ORPHAN_CONVERTER = 'SYSTEM_ORPHAN_CONVERTER',

  /**
   * The aggregate `<app>SystemStateStoredDataConverterMap` is not the last top-level export in `system.ts`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the converter-map declaration appears before another top-level export in `system.ts`.
   * @dbxRuleNotApplies Files where the convention isn't followed for project-specific reasons — but it makes scanning the aggregator harder.
   * @dbxRuleFix Move the `<app>SystemStateStoredDataConverterMap` declaration to the end of `system.ts` so it always sits below the triples it aggregates.
   */
  SYSTEM_CONVERTER_MAP_NOT_LAST = 'SYSTEM_CONVERTER_MAP_NOT_LAST',

  /**
   * The aggregate converter map references a key that is not a declared state-type constant in `system.ts`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a key on `<app>SystemStateStoredDataConverterMap` is neither a local `<NAME>_SYSTEM_STATE_TYPE` constant nor an imported identifier.
   * @dbxRuleNotApplies Keys imported from upstream packages — those are detected via `importedIdentifiers` and skipped.
   * @dbxRuleFix Either declare the missing constant locally or import it from the upstream package that owns it.
   */
  SYSTEM_UNKNOWN_MAP_KEY = 'SYSTEM_UNKNOWN_MAP_KEY'
}

/**
 * String-literal union derived from {@link SystemMValidateFolderCode}.
 */
export type SystemMValidateFolderCodeString = `${SystemMValidateFolderCode}`;
