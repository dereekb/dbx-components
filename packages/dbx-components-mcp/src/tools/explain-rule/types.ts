/**
 * Shared types for the `dbx_explain_rule` tool.
 *
 * Each rule explains one validation diagnostic emitted by a tool in the
 * dbx-components-mcp catalog (model, model-api, fixture, storagefile_m,
 * notification_m, system_m). The catalog is pure data — no AST, no I/O —
 * so the tool stays cheap and predictable.
 *
 * Authoring guideline: the four narrative fields (`whatItFlags`,
 * `whenItApplies`, `whenItDoesNotApply`, `canonicalFix`) are the actual
 * value the agent gets when triaging a diagnostic. Keep them concrete:
 * mention the source kind, the file convention, the matching constant
 * suffix. Use bullet-friendly prose — the formatter renders each as a
 * `## Heading` block.
 */

/**
 * Stable rule code emitted by a validator (the same string the tool puts
 * in `violation.code`). Free-form so the catalog can absorb new
 * codes without coupling to every per-domain literal union — the
 * catalog still owns the runtime list, and the search facet uses
 * the literal text directly.
 */
export type RuleCode = string;

/**
 * Severity tier of the rule. Mirrors what validators emit so callers
 * can decide which findings to gate on.
 */
export type RuleSeverity = 'error' | 'warning';

/**
 * Source tool that emits the rule (used for filtering / disambiguation
 * when multiple validators share a similar shape — e.g. the storagefile
 * folder validator vs. the cross-file app validator).
 */
export type RuleSource = 'dbx_model_validate' | 'dbx_model_validate_api' | 'dbx_model_validate_folder' | 'dbx_model_fixture_validate_app' | 'dbx_storagefile_m_validate_app' | 'dbx_storagefile_m_validate_folder' | 'dbx_notification_m_validate_app' | 'dbx_notification_m_validate_folder' | 'dbx_system_m_validate_folder';

/**
 * Optional cross-reference link that points the agent at a specific
 * artifact-file convention or sibling tool. Rendered as a bullet item.
 */
export interface RuleSeeAlso {
  readonly kind: 'tool' | 'artifact' | 'doc';
  readonly target: string;
  readonly note?: string;
}

/**
 * One rule entry in the catalog.
 */
export interface RuleEntry {
  readonly code: RuleCode;
  readonly source: RuleSource;
  readonly severity: RuleSeverity;
  readonly title: string;
  readonly whatItFlags: string;
  readonly whenItApplies: string;
  readonly whenItDoesNotApply: string;
  readonly canonicalFix: string;
  readonly seeAlso?: readonly RuleSeeAlso[];
}
