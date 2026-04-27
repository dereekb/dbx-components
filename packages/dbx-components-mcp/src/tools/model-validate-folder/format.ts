/**
 * Formats a {@link ValidationResult} as a markdown report suitable for
 * an MCP `text` content block. Groups violations by folder.
 */

import { formatFolderGroupedResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers. Violations are grouped by folder so readers see one section per
 * model directory.
 *
 * @param result - the aggregated folder-validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatFolderGroupedResult({ title: 'Model folder validation', result });
}
