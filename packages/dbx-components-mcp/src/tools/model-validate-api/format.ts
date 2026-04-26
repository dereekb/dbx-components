/**
 * Formats a {@link ValidationResult} as a markdown report suitable for an
 * MCP `text` content block. Groups violations by file, then by group
 * within the file, with a headline summary of pass/fail counts.
 */

import { formatFileGroupedResult } from '../validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers. Groups violations by file, then by rule group, with a headline
 * summary of pass/fail counts.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  return formatFileGroupedResult({
    title: 'Model API validation',
    summary: `Checked ${result.filesChecked} file(s), ${result.apisChecked} model-api(s).`,
    innerKey: (v) => v.group ?? '<file>',
    result
  });
}
