/**
 * Shared types for the rule catalog — emitted by the
 * `extract-rule-catalog` build script and consumed at runtime by
 * `dbx_explain_rule`, every domain's `pushViolation` helper (for
 * remediation auto-attach), and the `dbx_app_validate` orchestrator.
 *
 * The catalog is **derived** from JSDoc + `@dbxRule*` tags on the
 * `enum` members in each cluster's `codes.ts`. Editing the JSON or
 * the generated `.ts` re-export by hand is unsupported — re-run the
 * `generate-rule-catalog` Nx target instead.
 */

/**
 * Severity tier of a rule. Mirrors the `ViolationSeverity` literal used
 * by every per-domain validator so the catalog and the runtime emission
 * speak the same vocabulary.
 */
export type RuleSeverity = 'error' | 'warning';

/**
 * MCP tool that emits the rule. Pinned to the literal tool name so a
 * grep / mass rename keeps the catalog and the tool dispatch table in
 * sync.
 */
export type RuleSource = 'dbx_model_validate' | 'dbx_model_validate_api' | 'dbx_model_validate_folder' | 'dbx_model_fixture_validate_app' | 'dbx_storagefile_m_validate_app' | 'dbx_storagefile_m_validate_folder' | 'dbx_notification_m_validate_app' | 'dbx_notification_m_validate_folder' | 'dbx_system_m_validate_folder';

/**
 * Cross-reference target attached to a rule. The `kind` discriminator
 * picks how `dbx_explain_rule` renders the link — `artifact` references
 * resolve through `dbx_artifact_file_convention`, `tool` references
 * point at another MCP tool by name, and `doc` is a free-form pointer
 * (skill name, doc URL).
 */
export interface RuleSeeAlso {
  readonly kind: 'artifact' | 'tool' | 'doc';
  readonly target: string;
  readonly note?: string;
}

/**
 * One rule entry in the catalog. Authored as an `enum` member with
 * JSDoc + `@dbxRule*` tags; the build-time scanner reshapes that into
 * this object before emitting the JSON.
 *
 * Required fields are guaranteed by the scanner — it fails the build
 * when any of `whatItFlags` / `whenItApplies` / `whenItDoesNotApply` /
 * `canonicalFix` is missing.
 */
export interface RuleEntry {
  readonly code: string;
  readonly source: RuleSource;
  readonly severity: RuleSeverity;
  readonly title: string;
  readonly whatItFlags: string;
  readonly whenItApplies: string;
  readonly whenItDoesNotApply: string;
  readonly canonicalFix: string;
  readonly canonicalFixTemplate?: string;
  readonly seeAlso?: readonly RuleSeeAlso[];
}

/**
 * Auto-attached remediation hint that every per-domain `Violation`
 * carries when a catalog entry exists for the emitted code. Rendered as
 * a nested bullet block under the violation's primary message.
 */
export interface RemediationHint {
  readonly fix: string;
  readonly template?: string;
  readonly seeAlso?: readonly RuleSeeAlso[];
}
