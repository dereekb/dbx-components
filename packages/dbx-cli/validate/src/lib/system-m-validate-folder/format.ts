/**
 * Formats a {@link ValidationResult} as a markdown report suitable for
 * an MCP `text` content block, grouping violations by folder.
 */

import { formatFolderGroupedResult } from '../_core/validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers, grouping violations by folder.
 *
 * @param result - The aggregated validation outcome.
 * @returns The markdown report.
 */
export function formatResult(result: ValidationResult): string {
  return formatFolderGroupedResult({ title: 'System folder validation', result });
}
