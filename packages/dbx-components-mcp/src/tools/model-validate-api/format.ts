/**
 * Formats a {@link ValidationResult} as a markdown report suitable for an
 * MCP `text` content block. Groups violations by file, then by group
 * within the file, with a headline summary of pass/fail counts.
 */

import type { ValidationResult, Violation } from './types.js';

/**
 * Renders a {@link ValidationResult} as the markdown report the tool returns
 * to callers. Groups violations by file, then by rule group, with a headline
 * summary of pass/fail counts.
 *
 * @param result - the aggregated validation outcome
 * @returns the markdown report
 */
export function formatResult(result: ValidationResult): string {
  const { violations, errorCount, warningCount, filesChecked, apisChecked } = result;
  const status = statusLabel(errorCount, warningCount);
  const lines: string[] = [];
  lines.push(`# Model API validation — ${status}`);
  lines.push('');
  lines.push(`Checked ${filesChecked} file(s), ${apisChecked} model-api(s). ${errorCount} error(s), ${warningCount} warning(s).`);
  if (violations.length === 0) {
    return lines.join('\n');
  }

  const byFile = groupByFile(violations);
  for (const [file, fileViolations] of byFile) {
    lines.push('');
    lines.push(`## ${file}`);
    const byGroup = groupByGroup(fileViolations);
    for (const [groupKey, groupViolations] of byGroup) {
      lines.push('');
      lines.push(`### ${groupKey}`);
      for (const v of groupViolations) {
        const location = v.line !== undefined ? `line ${v.line}` : 'file-level';
        const label = v.severity === 'error' ? 'ERROR' : 'WARN';
        lines.push(`- **[${label}] ${v.code}** _(${location})_ — ${v.message}`);
      }
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

function groupByFile(violations: readonly Violation[]): Map<string, readonly Violation[]> {
  const out = new Map<string, Violation[]>();
  for (const v of violations) {
    const existing = out.get(v.file);
    if (existing) {
      existing.push(v);
    } else {
      out.set(v.file, [v]);
    }
  }
  return out;
}

function groupByGroup(violations: readonly Violation[]): Map<string, readonly Violation[]> {
  const out = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = v.group ?? '<file>';
    const existing = out.get(key);
    if (existing) {
      existing.push(v);
    } else {
      out.set(key, [v]);
    }
  }
  return out;
}
