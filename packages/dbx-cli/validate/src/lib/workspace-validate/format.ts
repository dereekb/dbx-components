/**
 * Formats a {@link ValidationResult} as a markdown report suitable for an MCP
 * `text` content block or a CLI stdout dump, grouping violations by the config
 * file the fix belongs in and then by project.
 */

import { formatFileGroupedResult } from '../_core/validate-format.js';
import type { ValidationResult } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers.
 *
 * @param result - The aggregated validation outcome.
 * @returns The markdown report.
 */
export function formatResult(result: ValidationResult): string {
  return formatFileGroupedResult({
    title: 'Workspace convention validation',
    summary: `Checked ${result.projectsChecked} project(s) and ${result.referencesChecked} target reference(s) across group(s) [${result.groups.join(', ')}].`,
    innerKey: (violation) => violation.project,
    result
  });
}
