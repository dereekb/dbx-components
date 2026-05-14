/**
 * Formatters for `dbx_model_api_list_app`. Renders the extraction as either
 * grouped markdown tables (default) or a flat JSON payload.
 */

import type { ApiListEntry, ApiListFileSummary, ApiListReport } from './types.js';

/**
 * Renders the model-API list extraction as grouped markdown tables, one section per scanned `*.api.ts` file.
 *
 * @param report - The extracted API list report.
 * @returns A markdown document summarizing the report.
 */
/**
 * Renders one file's section of the model-API list report: heading,
 * model labels, counts, the per-entry table, and any non-empty entry
 * descriptions.
 *
 * @param fileSummary - the file-level summary (group name + counts)
 * @param fileEntries - the entries belonging to this file
 * @returns the markdown lines for this file's section
 */
function formatFileSection(fileSummary: ApiListFileSummary, fileEntries: readonly ApiListEntry[]): readonly string[] {
  const modelLabels = fileSummary.modelKeys.length === 0 ? '_(none)_' : fileSummary.modelKeys.map((m) => `\`${m}\``).join(', ');
  const lines: string[] = [`## ${fileSummary.groupName ?? '(unknown group)'} — \`${fileSummary.sourceFile}\``, '', `Models: ${modelLabels}`, '', formatCounts(fileSummary), ''];
  if (fileEntries.length === 0) {
    lines.push('_(no entries)_', '');
    return lines;
  }
  lines.push('| Model | Verb | Specifier | Params | Result | Line |', '| --- | --- | --- | --- | --- | --- |');
  for (const entry of fileEntries) {
    lines.push(formatEntryRow(entry));
  }
  lines.push('');
  const described = fileEntries.filter((entry) => entry.description !== undefined && entry.description.length > 0);
  for (const entry of described) {
    lines.push(formatEntryDescription(entry), '');
  }
  return lines;
}

/**
 * Renders the model-API list extraction as grouped markdown tables, one
 * section per scanned `*.api.ts` file.
 *
 * @param report - The extracted API list report.
 * @returns A markdown document summarizing the report.
 */
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
    lines.push(...formatFileSection(fileSummary, fileEntries));
  }
  return lines.join('\n');
}

/**
 * Renders the model-API list extraction as a flat JSON payload.
 *
 * @param report - The extracted API list report.
 * @returns Pretty-printed JSON string for the report.
 */
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

function formatEntryDescription(entry: ApiListEntry): string {
  const heading = entry.specifier === undefined ? `${entry.model}.${entry.verb}` : `${entry.model}.${entry.verb}.${entry.specifier}`;
  const description = entry.description ?? '';
  const quoted = description
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `**${heading}**\n\n${quoted}`;
}
