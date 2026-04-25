/**
 * Formats a {@link ValidationResult} as a markdown report suitable
 * for an MCP `text` content block. Groups violations by side
 * (component / api).
 */

import type { ValidationResult, Violation } from './types.js';

export function formatResult(result: ValidationResult): string {
  const { violations, errorCount, warningCount, componentDir, apiDir } = result;
  const status = statusLabel(errorCount, warningCount);
  const lines: string[] = [];
  lines.push(`# Notification folder validation — ${status}`);
  lines.push('');
  lines.push(`Component: \`${componentDir}\` · API: \`${apiDir}\``);
  lines.push(`${errorCount} error(s), ${warningCount} warning(s).`);
  if (violations.length === 0) {
    return lines.join('\n');
  }

  const grouped = groupBySide(violations);
  for (const side of ['component', 'api'] as const) {
    const sideViolations = grouped.get(side);
    if (!sideViolations || sideViolations.length === 0) continue;
    lines.push('');
    lines.push(`## ${side === 'component' ? 'Component' : 'API'}`);
    for (const v of sideViolations) {
      const label = v.severity === 'error' ? 'ERROR' : 'WARN';
      const locationPart = v.file ? ` _(file: ${v.file})_` : '';
      lines.push(`- **[${label}] ${v.code}**${locationPart} — ${v.message}`);
    }
  }

  return lines.join('\n');
}

function statusLabel(errorCount: number, warningCount: number): string {
  let result: string;
  if (errorCount > 0) {
    result = 'FAIL';
  } else if (warningCount > 0) {
    result = 'PASS WITH WARNINGS';
  } else {
    result = 'PASS';
  }
  return result;
}

function groupBySide(violations: readonly Violation[]): Map<'component' | 'api', readonly Violation[]> {
  const out = new Map<'component' | 'api', Violation[]>();
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
