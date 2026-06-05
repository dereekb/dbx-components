/**
 * Violation codes emitted by `dbx_model_api_validate_app`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * The validator reconciles every CRUD entry declared on a downstream
 * `-firebase` component's `<model>.api.ts` against the handler map
 * defined in the API app's `<app>FunctionMap` / `<app>CrudFunctionsConfig`.
 * Two reconciliation gaps fire (`MISSING_HANDLER` / `ORPHAN_HANDLER`),
 * plus a naming-convention check on every wired handler
 * (`HANDLER_NAMING_MISMATCH`).
 */
export enum ModelApiValidateAppCode {
  /**
   * A CRUD entry is declared in the component's `<model>.api.ts` but the
   * API app's verb-map has no matching handler wired in.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared `<model>.<verb>.<specifier>` cell that lacks a `<handlerName>:` entry under the corresponding verb in the app's `*FunctionMap`.
   * @dbxRuleNotApplies When the handler is intentionally not yet wired — declare the api entry inside a `// @ts-expect-error TODO` block, or remove the declaration until the handler lands.
   * @dbxRuleFix Add a handler whose name follows `<model><Verb>[<Specifier>]` (e.g. `guestbookEntryUpdateInsert`) to the app's verb-map and assign it to the matching cell.
   * @dbxRuleSeeAlso tool:dbx_model_api_list_app
   * @dbxRuleSeeAlso tool:dbx_model_api_lookup
   */
  MISSING_HANDLER = 'MISSING_HANDLER',

  /**
   * A handler is wired in the API app's verb-map but no
   * `<model>.api.ts` in any component declares this CRUD entry.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every cell of the app's verb-map that is not declared by an upstream `*ModelCrudFunctionsConfig`.
   * @dbxRuleNotApplies Handlers exposed by an upstream `@dereekb/*` package whose api file lives outside the scanned component dirs.
   * @dbxRuleFix Either remove the orphan handler entry, or add the missing CRUD declaration to the matching `<model>.api.ts` so the surface is documented.
   * @dbxRuleSeeAlso tool:dbx_model_api_list_app
   */
  ORPHAN_HANDLER = 'ORPHAN_HANDLER',

  /**
   * A handler name does not follow the canonical
   * `<model><Verb>[<Specifier>]` form, so the verb-map cell and the
   * handler symbol drift apart.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every wired handler whose identifier does not match either the full form (`guestbookEntryUpdateInsert`) or the verb-omitted shorthand (`guestbookEntryInsert`) for its cell.
   * @dbxRuleNotApplies Handlers intentionally aliased to satisfy backwards-compatibility on a public re-export — colocate the alias in the verb-map by name to keep the cell aligned.
   * @dbxRuleFix Rename the handler (or its verb-map binding) to one of the accepted names so the model/verb/specifier triplet is recoverable from the identifier alone.
   */
  HANDLER_NAMING_MISMATCH = 'HANDLER_NAMING_MISMATCH'
}

/**
 * String-literal union derived from {@link ModelApiValidateAppCode}.
 * Used by {@link ValidateIssue} so the `code` field is a narrow literal
 * type rather than the enum object reference.
 */
export type ModelApiValidateAppCodeString = `${ModelApiValidateAppCode}`;
