/**
 * Formats a {@link ValidationResult} as a markdown report suitable for
 * an MCP `text` content block. Violations are grouped by side
 * (component / api / cross-side).
 */

import { formatTwoSideResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

const FOOTER = '_Run `dbx_asset_scaffold` to generate a new asset constant, or `dbx_explain_rule` for the rule details. Local refs must be placed at `<appDir>/src/assets/<path>` for Angular CLI to copy them to the build output._';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool
 * returns to callers.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatTwoSideResult({ title: 'App assets validation', result, footer: FOOTER });
}
