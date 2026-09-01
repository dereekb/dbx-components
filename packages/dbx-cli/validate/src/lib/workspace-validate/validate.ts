/**
 * Pure validation entry point for the workspace validator. Callers pass a
 * {@link WorkspaceInspection} (prepared by `./inspect.ts`) and receive a
 * {@link ValidationResult}.
 */

import { runRules } from './rules.js';
import { WORKSPACE_RULE_GROUPS, type ValidationResult, type Violation, type WorkspaceInspection, type WorkspaceRuleGroup } from './types.js';

/**
 * Input for {@link validateWorkspace}.
 */
export interface ValidateWorkspaceInput {
  readonly inspection: WorkspaceInspection;
  /**
   * Rule groups to run. Defaults to every group.
   */
  readonly groups?: readonly WorkspaceRuleGroup[] | undefined;
}

/**
 * Runs the enabled rule groups over a workspace inspection and aggregates the
 * violations and counts.
 *
 * @param input - The workspace snapshot and the rule groups to run.
 * @returns The aggregated validation outcome with counts and violations.
 */
export function validateWorkspace(input: ValidateWorkspaceInput): ValidationResult {
  const { inspection } = input;
  const groups = input.groups === undefined || input.groups.length === 0 ? WORKSPACE_RULE_GROUPS : input.groups;
  const violations: readonly Violation[] = runRules({ inspection, groups });

  let errorCount = 0;
  let warningCount = 0;
  for (const violation of violations) {
    if (violation.severity === 'error') {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
  }

  return {
    violations,
    errorCount,
    warningCount,
    projectsChecked: inspection.projects.length,
    referencesChecked: inspection.references.length,
    groups
  };
}
