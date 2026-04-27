/**
 * Pure validation entry point for the model-folder validator. Callers pass one
 * or more {@link FolderInspection} records (prepared by the tool wrapper via
 * `node:fs/promises`) and receive a {@link ValidationResult}. The MCP tool
 * layer supplies the file-system inspection on top of this.
 */

import { aggregateFolderRules } from '../validate-format.js';
import { runRules } from './rules.js';
import type { FolderInspection, ValidationResult } from './types.js';

/**
 * Runs the rules layer over each prepared folder inspection and aggregates
 * the violations and counts.
 *
 * @param inspections - the folder snapshots to validate
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateModelFolders(inspections: readonly FolderInspection[]): ValidationResult {
  return aggregateFolderRules({ inspections, runRules });
}
