/**
 * Pure validation entry point for the model-folder validator. Callers pass one
 * or more {@link FolderInspection} records (prepared by the tool wrapper via
 * `node:fs/promises`) and receive a {@link ValidationResult}. The MCP tool
 * layer supplies the file-system inspection on top of this.
 */

import type { RuleOptions } from '../model-validate/index.js';
import { aggregateFolderRules } from '../validate-format.js';
import { runRules } from './rules.js';
import type { FolderInspection, ValidationResult } from './types.js';

/**
 * Runs the rules layer over each prepared folder inspection and aggregates
 * the violations and counts.
 *
 * @param inspections - The folder snapshots to validate.
 * @param options - Optional per-call overrides forwarded to the per-file
 *   content validator (field-name length limit, ignored field names,
 *   ignored external sub-object parents)
 * @returns The aggregated validation outcome with counts and violations.
 */
export function validateModelFolders(inspections: readonly FolderInspection[], options?: RuleOptions): ValidationResult {
  return aggregateFolderRules({ inspections, runRules: (inspection) => runRules(inspection, options) });
}
