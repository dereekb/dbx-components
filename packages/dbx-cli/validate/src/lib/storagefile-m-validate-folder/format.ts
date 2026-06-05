/**
 * Formats a {@link ValidationResult} as a markdown report suitable
 * for an MCP `text` content block. Groups violations by side
 * (component / api).
 */

import { formatTwoSideResult } from '../_core/validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers, grouping violations by side (component / api).
 *
 * @param result - The aggregated folder-validation outcome.
 * @returns The markdown report.
 */
export function formatResult(result: ValidationResult): string {
  return formatTwoSideResult({ title: 'StorageFile folder validation', result });
}
