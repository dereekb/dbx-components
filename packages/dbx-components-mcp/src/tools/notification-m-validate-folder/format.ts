/**
 * Formats a {@link ValidationResult} as a markdown report suitable
 * for an MCP `text` content block. Groups violations by side
 * (component / api).
 */

import { formatTwoSideResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers, grouping violations by side (component / api) so each report
 * row points at the directory needing the fix.
 *
 * @param result - the aggregated folder-validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatTwoSideResult({ title: 'Notification folder validation', result });
}
