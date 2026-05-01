/**
 * Markdown / JSON renderers for `dbx_model_api_validate_app`.
 */

import type { ReconciledEntry, ValidateReport } from './types.js';

export function formatValidationAsMarkdown(report: ValidateReport): string {
  const lines: string[] = [`# Model API validation — ${report.apiDir}`, '', `Component: \`${report.componentDir}\``, `Handler map: \`${report.handlerMapPath}\``];
  if (report.modelFilter) {
    lines.push(`Filter: \`${report.modelFilter}\``);
  }
  lines.push('', formatHandlerMapStatus(report), '', `Errors: ${report.errorCount} · Warnings: ${report.warningCount}`, '');

  if (report.summaries.length === 0) {
    lines.push('_No models reconciled._', '');
    return lines.join('\n');
  }

  for (const summary of report.summaries) {
    const modelEntries = report.entries.filter((e) => e.model === summary.model);
    lines.push(`## \`${summary.model}\``, '', `Declared: ${summary.declaredCount} · Handled: ${summary.handledCount} · Matched: ${summary.matchedCount} · Errors: ${summary.errorCount}`, '', '| Verb | Specifier | Declared | Handler | Status |', '| --- | --- | --- | --- | --- |');
    for (const entry of modelEntries) {
      lines.push(formatEntryRow(entry));
    }
    lines.push('');
  }

  if (report.issues.length > 0) {
    lines.push('## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- **${issue.code}** \`${issue.model}${issue.verb ? `.${issue.verb}` : ''}${issue.specifier ? `.${issue.specifier}` : ''}\` — ${issue.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatValidationAsJson(report: ValidateReport): string {
  return JSON.stringify(report, null, 2);
}

function formatHandlerMapStatus(report: ValidateReport): string {
  switch (report.handlerMapStatus.kind) {
    case 'ok':
      return `Verbs found: ${report.handlerMapStatus.verbsFound.length === 0 ? '_(none)_' : report.handlerMapStatus.verbsFound.map((v) => `\`${v}\``).join(', ')}`;
    case 'missing':
      return `_Handler map not found at \`${report.handlerMapStatus.path}\` — every declared call will be flagged as MISSING HANDLER._`;
    case 'error':
      return `_Handler map parse error: ${report.handlerMapStatus.message}_`;
  }
}

function formatEntryRow(entry: ReconciledEntry): string {
  const verb = `\`${entry.verb}\``;
  const specifier = entry.specifier === undefined ? '—' : `\`${entry.specifier}\``;
  const declared = entry.declared ? `\`${entry.declared.paramsTypeName ?? '?'}\` (\`${entry.declared.sourceFile}:${entry.declared.line}\`)` : '—';
  const handler = entry.handler ? `\`${entry.handler.handlerName}\`` : '—';
  const status = entry.declared && entry.handler ? 'matched' : entry.declared ? 'MISSING HANDLER' : 'ORPHAN HANDLER';
  return `| ${verb} | ${specifier} | ${declared} | ${handler} | ${status} |`;
}
