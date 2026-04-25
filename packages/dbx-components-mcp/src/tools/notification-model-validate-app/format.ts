/**
 * Formats a {@link ValidationResult} as a markdown report suitable for
 * an MCP `text` content block. Violations are grouped by side
 * (component / api / both).
 */

import type { ValidationResult, Violation } from './types.js';

export function formatResult(result: ValidationResult): string {
  const { violations, errorCount, warningCount, componentDir, apiDir } = result;
  const status = statusLabel(errorCount, warningCount);
  const lines: string[] = [];
  lines.push(`# App notifications validation — ${status}`);
  lines.push('');
  lines.push(`Component: \`${componentDir}\``);
  lines.push(`API: \`${apiDir}\``);
  lines.push(`${errorCount} error(s), ${warningCount} warning(s).`);
  if (violations.length === 0) {
    return lines.join('\n');
  }

  const grouped = groupBySide(violations);
  for (const [side, group] of grouped) {
    lines.push('');
    lines.push(`## ${side === 'both' ? 'Cross-side' : side === 'component' ? 'Component' : 'API'}`);
    for (const v of group) {
      const label = v.severity === 'error' ? 'ERROR' : 'WARN';
      const locationPart = v.file ? ` _(file: ${v.file})_` : '';
      lines.push(`- **[${label}] ${v.code}**${locationPart} — ${v.message}`);
    }
  }

  lines.push('');
  lines.push("_Run `dbx_file_convention` with `{artifact: 'notification-template'}` or `{artifact: 'notification-task'}` to see canonical paths and wiring for missing pieces._");

  return lines.join('\n');
}

function statusLabel(errorCount: number, warningCount: number): string {
  if (errorCount > 0) return 'FAIL';
  if (warningCount > 0) return 'PASS WITH WARNINGS';
  return 'PASS';
}

function groupBySide(violations: readonly Violation[]): Map<Violation['side'], readonly Violation[]> {
  const out = new Map<Violation['side'], Violation[]>();
  for (const v of violations) {
    const existing = out.get(v.side);
    if (existing) {
      existing.push(v);
    } else {
      out.set(v.side, [v]);
    }
  }
  return out;
}
