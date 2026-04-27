/**
 * Pure validation entry point for the system-folder validator. Callers pass
 * one or more {@link SystemFolderInspection} records (prepared by the tool
 * wrapper via `node:fs/promises`) and receive a {@link ValidationResult}.
 */

import { aggregateFolderRules } from '../validate-format.js';
import { runRules } from './rules.js';
import type { SystemFolderInspection, ValidationResult } from './types.js';

/**
 * Runs the rules layer over each prepared folder inspection and aggregates
 * the violations and counts.
 *
 * @param inspections - the folder snapshots to validate
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateSystemFolders(inspections: readonly SystemFolderInspection[]): ValidationResult {
  return aggregateFolderRules({ inspections, runRules });
}
