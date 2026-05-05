/**
 * Formats a folder-validation {@link ValidationResult} as a markdown
 * report.
 */

import { formatTwoSideResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

const FOOTER = '_Run `dbx_asset_validate_app` to also verify provider wiring and local file existence._';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool
 * returns to callers.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatTwoSideResult({ title: 'Asset folder validation', result, footer: FOOTER });
}
