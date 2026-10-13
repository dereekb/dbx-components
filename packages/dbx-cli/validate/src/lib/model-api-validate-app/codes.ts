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
 * (`HANDLER_NAMING_MISMATCH`) and an MCP read/write check on every
 * `invoke` / custom-verb handler (`HANDLER_MCP_READ_ONLY_UNSET`, a warning).
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
  HANDLER_NAMING_MISMATCH = 'HANDLER_NAMING_MISMATCH',

  /**
   * An `invoke` or custom-verb handler leaves `mcp.readOnly` unset, so MCP treats it as a write.
   * Only `read`/`query` (read) and `create`/`update`/`delete` (write) infer the classification from
   * the call type. Every other call type resolves to "unknown", which the MCP module fails safe to a
   * write: the method is only callable through the write tool (`<p>_mcp_write`), is advertised
   * `destructiveHint: true`, and is dropped when the MCP module runs in `readOnly` mode. A pure-read
   * invoke that forgets the flag silently disappears from the read tool.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every handler wired in the app's `invoke` (or custom-verb) map whose `withApiDetails({ ... })` declaration has no `mcp` block, or an `mcp` block without `readOnly`.
   * @dbxRuleNotApplies Handlers under `read`/`query`/`create`/`update`/`delete`, whose call type decides. Handlers the scan cannot follow back to a literal `withApiDetails({ ... })` — imported from an `@dereekb/*` package or from outside `src/app/function/`, built by a factory or inline, or whose config / `mcp` comes from a spread or a non-literal — are listed as not checked instead. Plain-function handlers without `withApiDetails` never become MCP tools.
   * @dbxRuleFix Declare `mcp: { readOnly: true }` when the handler only reads, or `mcp: { readOnly: false }` when it writes (persists, sends, or calls out), with a short comment saying why.
   * @dbxRuleSeeAlso doc:dbx__guide__invoke-mcp-builder
   * @dbxRuleSeeAlso tool:dbx_model_api_lookup
   */
  HANDLER_MCP_READ_ONLY_UNSET = 'HANDLER_MCP_READ_ONLY_UNSET'
}

/**
 * String-literal union derived from {@link ModelApiValidateAppCode}.
 * Used by {@link ValidateIssue} so the `code` field is a narrow literal
 * type rather than the enum object reference.
 */
export type ModelApiValidateAppCodeString = `${ModelApiValidateAppCode}`;
