/**
 * Formats a {@link ValidationResult} as a markdown report suitable for
 * an MCP `text` content block. Violations are grouped by side
 * (component / api / cross-side).
 */

import { formatTwoSideResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

const FOOTER = "_Run `dbx_artifact_file_convention` with the relevant artifact (e.g. `{artifact: 'storagefile-purpose'}`, `'storagefile-upload-handler'`, `'storagefile-processor'`, `'storagefile-processor-subtask'`) to see canonical paths and wiring for missing pieces._";

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers. Violations are grouped by side (component / api / cross-side)
 * so readers see which package needs the fix.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatTwoSideResult({ title: 'App storagefiles validation', result, footer: FOOTER });
}
