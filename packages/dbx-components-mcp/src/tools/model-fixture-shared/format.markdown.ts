/**
 * Markdown formatter for the `dbx_model_fixture_validate_app` report.
 *
 * The listing + lookup markdown formatters now live in
 * `@dereekb/dbx-cli/model-test`; this file keeps the validation report
 * renderer alongside the validator it formats.
 */

import type { FixtureValidationResult } from './types.js';

/**
 * Renders the validation report for `dbx_model_fixture_validate_app`.
 *
 * @param result - The validation result.
 * @returns The markdown body.
 */
export function formatValidationAsMarkdown(result: FixtureValidationResult): string {
  const lines: string[] = [`# Fixture validation — ${result.fixturePath}`, '', `Errors: ${result.errorCount}`, `Warnings: ${result.warningCount}`];
  if (result.diagnostics.length === 0) {
    lines.push('', '_No diagnostics._');
    return lines.join('\n');
  }
  lines.push('', '## Diagnostics');
  for (const d of result.diagnostics) {
    appendDiagnosticEntry(lines, d);
  }
  return lines.join('\n');
}

function appendDiagnosticEntry(lines: string[], d: FixtureValidationResult['diagnostics'][number]): void {
  const linePart = d.line === undefined ? '' : ` (line ${d.line})`;
  const modelPart = d.model === undefined ? '' : ` [${d.model}]`;
  lines.push('', `- **${d.severity.toUpperCase()}** \`${d.code}\`${modelPart}${linePart}: ${d.message}`);
  if (!d.remediation) return;
  lines.push(`  - Fix: ${d.remediation.fix}`);
  if (d.remediation.template) {
    lines.push('  - Template:');
    for (const tline of d.remediation.template.split('\n')) {
      lines.push(`      ${tline}`);
    }
  }
  if (d.remediation.seeAlso && d.remediation.seeAlso.length > 0) {
    const refs = d.remediation.seeAlso.map((r) => `${r.kind}:\`${r.target}\``).join(', ');
    lines.push(`  - See also: ${refs}`);
  }
}
