/**
 * Violation codes emitted by `dbx_model_test_validate_app`.
 *
 * Each member is the source of truth for its rule documentation. The
 * `extract-rule-catalog` build script walks the JSDoc summary + `@dbxRule*`
 * tags off each member and emits `generated/rule-catalog.generated.json`,
 * which feeds `dbx_explain_rule` and the per-domain `pushViolation` helper
 * that auto-attaches a `RemediationHint` to every emitted violation.
 *
 * Keep the JSDoc summary short (one paragraph). The full tag vocabulary is
 * documented in `src/tools/rule-catalog/types.ts`.
 */
export enum ModelTestValidateAppCode {
  /**
   * Spec filename uses a `crud` / `scenario` segment that is not directly
   * after the group name (e.g. `worker.payroll.scenario.spec.ts` or
   * `worker.pay.crud.spec.ts`). The canonical form places the bucket
   * marker immediately after the group: `<group>.scenario.<sub>.spec.ts`
   * or `<group>.crud.<sub>.spec.ts`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any spec file under `<apiDir>/src/app/function/<group>/` where the `crud` / `scenario` segment is not the first non-group segment.
   * @dbxRuleNotApplies Canonical subgroup names like `job.crud.requirement.spec.ts` — there `crud` is already first.
   * @dbxRuleFix Rename to the canonical `<group>.<bucket>.<sub>.spec.ts` form. The validator emits the recommended filename as part of the violation message.
   * @dbxRuleSeeAlso tool:dbx_model_test_convention
   */
  TEST_FILE_DRIFT_RENAME = 'TEST_FILE_DRIFT_RENAME',

  /**
   * Spec filename is missing a `crud` / `scenario` bucket segment entirely
   * (e.g. `worker.system.spec.ts`). The validator can't tell whether the
   * file documents CRUD behavior or a workflow scenario — the author must
   * choose one.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Spec files where no segment after the group name is `crud` or `scenario`.
   * @dbxRuleNotApplies Files that already have a `crud` / `scenario` marker anywhere in the name (those surface `TEST_FILE_DRIFT_RENAME` instead when misplaced).
   * @dbxRuleFix Decide whether the file's tests are CRUD-flavored or scenario-flavored, then rename to `<group>.crud.<sub>.spec.ts` or `<group>.scenario.<sub>.spec.ts`. Default to `scenario` when in doubt.
   * @dbxRuleSeeAlso tool:dbx_model_test_convention
   */
  TEST_FILE_MISSING_BUCKET = 'TEST_FILE_MISSING_BUCKET',

  /**
   * Spec file's first filename segment doesn't match its parent folder
   * (e.g. `storagefile.scenario.jobrequirement.spec.ts` placed under the
   * `job/` folder). Tests should live in the folder of the model group
   * named by their filename prefix.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any `.spec.ts` whose first dot-separated segment differs from the immediate parent folder name.
   * @dbxRuleNotApplies Spec files that intentionally test cross-model integration — move those to the primary group's folder and rename so the prefix matches, or keep them as scenario sub-buckets of one side.
   * @dbxRuleFix Move the file into `<apiDir>/src/app/function/<first-segment>/` so the prefix matches the folder, or rename the file's first segment to match the current folder.
   * @dbxRuleSeeAlso tool:dbx_model_test_convention
   */
  TEST_FILE_NON_GROUP_PLACEMENT = 'TEST_FILE_NON_GROUP_PLACEMENT',

  /**
   * A model group declared on the component side has no `<group>.crud.spec.ts`
   * file on the API side. Every model group is expected to have at least a
   * baseline CRUD spec exercising create / read / update / delete plus
   * permission paths. Scenario specs are optional.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every model group enumerated from the `-firebase` component (`<componentDir>/src/lib/model/<group>/`) that doesn't have a matching `<group>.crud.spec.ts` under `<apiDir>/src/app/function/<group>/`.
   * @dbxRuleNotApplies Reserved folders (`system`, `notification`, `storagefile`) — those follow distinct test layouts. Cross-group integration tests likewise don't satisfy this rule for their host group.
   * @dbxRuleFix Add `<apiDir>/src/app/function/<group>/<group>.crud.spec.ts` covering the CRUD function map for the group. Use `dbx_model_test_convention` to fetch the canonical path.
   * @dbxRuleSeeAlso tool:dbx_model_test_convention
   */
  MODEL_GROUP_MISSING_CRUD_SPEC = 'MODEL_GROUP_MISSING_CRUD_SPEC'
}

/**
 * String-literal union derived from {@link ModelTestValidateAppCode}.
 * Use this anywhere you previously wrote the string-literal union by
 * hand — `pushViolation({ code: 'TEST_FILE_DRIFT_RENAME', ... })` continues
 * to typecheck because the template literal widens to the same set.
 */
export type ModelTestValidateAppCodeString = `${ModelTestValidateAppCode}`;
