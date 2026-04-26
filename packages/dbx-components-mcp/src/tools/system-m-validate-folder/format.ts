/**
 * Formats a {@link ValidationResult} as a markdown report suitable for
 * an MCP `text` content block. Groups violations by folder.
 */

import type { ValidationResult, Violation } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers, grouping violations by folder.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  const { violations, errorCount, warningCount, foldersChecked } = result;
  const status = statusLabel(errorCount, warningCount);
  const lines: string[] = [];
  lines.push(`# System folder validation — ${status}`);
  lines.push('');
  lines.push(`Checked ${foldersChecked} folder(s). ${errorCount} error(s), ${warningCount} warning(s).`);
  if (violations.length === 0) {
    return lines.join('\n');
  }

  const byFolder = groupByFolder(violations);
  for (const [folder, folderViolations] of byFolder) {
    lines.push('');
    lines.push(`## ${folder}`);
    for (const v of folderViolations) {
      const label = v.severity === 'error' ? 'ERROR' : 'WARN';
      const locationPart = v.file ? ` _(file: ${v.file})_` : '';
      lines.push(`- **[${label}] ${v.code}**${locationPart} — ${v.message}`);
    }
  }

  return lines.join('\n');
}

function statusLabel(errorCount: number, warningCount: number): string {
  if (errorCount > 0) {
    return 'FAIL';
  }
  if (warningCount > 0) {
    return 'PASS WITH WARNINGS';
  }
  return 'PASS';
}

function groupByFolder(violations: readonly Violation[]): Map<string, readonly Violation[]> {
  const out = new Map<string, Violation[]>();
  for (const v of violations) {
    const existing = out.get(v.folder);
    if (existing) {
      existing.push(v);
    } else {
      out.set(v.folder, [v]);
    }
  }
  return out;
}
