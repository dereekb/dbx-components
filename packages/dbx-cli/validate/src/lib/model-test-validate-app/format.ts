/**
 * Markdown / JSON renderers for `dbx_model_test_validate_app` results.
 *
 * Violations are bucketed by model group so a reader sees a per-group
 * summary first. The body of each section reuses
 * {@link formatViolationLine} so remediation hints render the same way
 * they do in every other validator's report.
 */

import { formatStatusLabel, formatViolationLine, groupViolations } from '../_core/validate-format.js';
import type { ModelTestValidateAppResult } from './types.js';

/**
 * Renders a {@link ModelTestValidateAppResult} as markdown. Used by the
 * MCP tool wrapper as the default response shape.
 *
 * @param result - The aggregated validator outcome.
 * @returns The markdown report.
 */
export function formatModelTestValidateAppMarkdown(result: ModelTestValidateAppResult): string {
  const { violations, errorCount, warningCount, componentDir, apiDir, specFilesChecked, modelGroupsChecked } = result;
  const lines: string[] = [`# Model test validation — ${formatStatusLabel(errorCount, warningCount)}`, '', `Component: \`${componentDir}\` · API: \`${apiDir}\``, `Checked ${modelGroupsChecked} model group(s) and ${specFilesChecked} spec file(s). ${errorCount} error(s), ${warningCount} warning(s).`];
  if (violations.length === 0) {
    lines.push('', 'All spec filenames are canonical and every model group has a baseline CRUD spec.');
    return lines.join('\n').trimEnd();
  }
  const byGroup = groupViolations(violations, (v) => v.group);
  for (const [group, groupViolationList] of byGroup) {
    lines.push('', `## ${group}`);
    for (const v of groupViolationList) {
      lines.push(formatViolationLine(v, v.file ? ` _(file: ${v.file})_` : ''));
    }
  }
  lines.push('', 'Run `dbx_model_test_convention { group: "<group>" }` for the canonical path of any rename target.');
  return lines.join('\n').trimEnd();
}

/**
 * Renders a {@link ModelTestValidateAppResult} as JSON. Echoes the full
 * result shape so callers can drive downstream tooling against the
 * structured form.
 *
 * @param result - The aggregated validator outcome.
 * @returns The JSON report (2-space indented).
 */
export function formatModelTestValidateAppJson(result: ModelTestValidateAppResult): string {
  return JSON.stringify(result, null, 2);
}
