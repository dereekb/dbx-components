/**
 * Formats a {@link ValidationResult} as a markdown report suitable for an
 * MCP `text` content block. Groups violations by file, then by model within
 * the file, with a headline summary of pass/fail counts.
 */

import { formatFileGroupedResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers. Groups violations by file, then by model within the file, so
 * readers see one section per identity definition.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatFileGroupedResult({
    title: 'Firebase model validation',
    summary: `Checked ${result.filesChecked} file(s), ${result.modelsChecked} model(s).`,
    innerKey: (v) => v.model ?? '<file>',
    result
  });
}
