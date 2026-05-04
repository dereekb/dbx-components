/**
 * Formatters for `dbx_model_api_list_app`. Renders the extraction as either
 * grouped markdown tables (default) or a flat JSON payload.
 */

import type { ApiListEntry, ApiListFileSummary, ApiListReport } from './types.js';

export function formatReportAsMarkdown(report: ApiListReport): string {
  const lines: string[] = [`# Model API calls — ${report.componentDir}`, ''];
  if (report.modelFilter !== undefined) {
    lines.push(`Filter: \`${report.modelFilter}\``, '');
  }

  if (report.files.length === 0) {
    lines.push('_No `<model>.api.ts` files with `callModelFirebaseFunctionMapFactory(...)` were found._', '');
    return lines.join('\n');
  }

  for (const fileSummary of report.files) {
    const fileEntries = report.entries.filter((entry) => entry.sourceFile === fileSummary.sourceFile);
    if (fileEntries.length === 0 && report.modelFilter !== undefined) {
      continue;
    }
    const modelLabels = fileSummary.modelKeys.length === 0 ? '_(none)_' : fileSummary.modelKeys.map((m) => `\`${m}\``).join(', ');
    lines.push(`## ${fileSummary.groupName ?? '(unknown group)'} — \`${fileSummary.sourceFile}\``, '', `Models: ${modelLabels}`, '', formatCounts(fileSummary), '');
    if (fileEntries.length === 0) {
      lines.push('_(no entries)_', '');
      continue;
    }
    lines.push('| Model | Verb | Specifier | Params | Result | Line |', '| --- | --- | --- | --- | --- | --- |');
    for (const entry of fileEntries) {
      lines.push(formatEntryRow(entry));
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatReportAsJson(report: ApiListReport): string {
  return JSON.stringify(report, null, 2);
}

function formatCounts(fileSummary: ApiListFileSummary): string {
  const c = fileSummary.counts;
  const parts: string[] = [];
  if (c.create > 0) parts.push(`create=${c.create}`);
  if (c.read > 0) parts.push(`read=${c.read}`);
  if (c.update > 0) parts.push(`update=${c.update}`);
  if (c.delete > 0) parts.push(`delete=${c.delete}`);
  if (c.query > 0) parts.push(`query=${c.query}`);
  if (c.standalone > 0) parts.push(`standalone=${c.standalone}`);
  return parts.length === 0 ? '_(no entries)_' : `Counts: ${parts.join(', ')}`;
}

function formatEntryRow(entry: ApiListEntry): string {
  const specifier = entry.specifier === undefined ? '—' : `\`${entry.specifier}\``;
  const params = entry.paramsTypeName ? `\`${entry.paramsTypeName}\`` : '_unresolved_';
  const result = entry.resultTypeName ? `\`${entry.resultTypeName}\`` : '`void`';
  return `| \`${entry.model}\` | \`${entry.verb}\` | ${specifier} | ${params} | ${result} | ${entry.line} |`;
}
