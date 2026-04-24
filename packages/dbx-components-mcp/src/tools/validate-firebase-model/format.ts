/**
 * Formats a {@link ValidationResult} as a markdown report suitable for an
 * MCP `text` content block. Groups violations by file, then by model within
 * the file, with a headline summary of pass/fail counts.
 */

import type { ValidationResult, Violation } from './types.js';

export function formatResult(result: ValidationResult): string {
  const { violations, errorCount, warningCount, filesChecked, modelsChecked } = result;
  const status = statusLabel(errorCount, warningCount);
  const lines: string[] = [];
  lines.push(`# Firebase model validation — ${status}`);
  lines.push('');
  lines.push(`Checked ${filesChecked} file(s), ${modelsChecked} model(s). ${errorCount} error(s), ${warningCount} warning(s).`);
  if (violations.length === 0) {
    return lines.join('\n');
  }

  const byFile = groupByFile(violations);
  for (const [file, fileViolations] of byFile) {
    lines.push('');
    lines.push(`## ${file}`);
    const byModel = groupByModel(fileViolations);
    for (const [modelKey, modelViolations] of byModel) {
      lines.push('');
      lines.push(`### ${modelKey}`);
      for (const v of modelViolations) {
        const location = v.line !== undefined ? `line ${v.line}` : 'file-level';
        const label = v.severity === 'error' ? 'ERROR' : 'WARN';
        lines.push(`- **[${label}] ${v.code}** _(${location})_ — ${v.message}`);
      }
    }
  }

  const out = lines.join('\n');
  return out;
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

function groupByModel(violations: readonly Violation[]): Map<string, readonly Violation[]> {
  const out = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = v.model ?? '<file>';
    const existing = out.get(key);
    if (existing) {
      existing.push(v);
    } else {
      out.set(key, [v]);
    }
  }
  return out;
}
