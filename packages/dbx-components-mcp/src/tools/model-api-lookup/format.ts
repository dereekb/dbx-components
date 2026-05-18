/**
 * Markdown / JSON renderers for `dbx_model_api_lookup`.
 */

import type { ApiLookupEntry, ApiLookupField, ApiLookupReport } from './types.js';

/**
 * Renders the model-API lookup report as a markdown document with one section per matched entry plus action/factory cross-references.
 *
 * @param report - The API lookup report to render.
 * @returns A markdown document.
 */
export function formatLookupAsMarkdown(report: ApiLookupReport): string {
  const heading = report.groupName ? `${report.groupName} (\`${report.modelFilter}\`)` : report.modelFilter;
  const lines: string[] = [`# Model API lookup — ${heading}`, '', `Component: \`${report.componentDir}\``];
  if (report.apiDir) {
    lines.push(`API app: \`${report.apiDir}\``);
  }
  if (report.sourceFile) {
    lines.push(`Source: \`${report.sourceFile}\``);
  }
  if (report.modelKeys.length > 0) {
    const modelLabels = report.modelKeys.map((m) => `\`${m}\``).join(', ');
    lines.push(`Models: ${modelLabels}`);
  }
  lines.push('', `Action lookup: ${formatActionLookupStatus(report)}`, '');

  if (report.entries.length === 0) {
    lines.push(`_No CRUD or standalone entries matched filter \`${report.modelFilter}\`._`, '');
    return lines.join('\n');
  }

  for (const entry of report.entries) {
    lines.push(formatEntry(entry), '');
  }
  return lines.join('\n');
}

/**
 * Renders the model-API lookup report as a flat JSON payload.
 *
 * @param report - The API lookup report to render.
 * @returns Pretty-printed JSON string for the report.
 */
export function formatLookupAsJson(report: ApiLookupReport): string {
  return JSON.stringify(report, null, 2);
}

function formatActionLookupStatus(report: ApiLookupReport): string {
  let result: string;
  switch (report.actionLookupStatus.kind) {
    case 'ok':
      result = `scanned ${report.actionLookupStatus.filesScanned} \`*.action.server.ts\` file(s)`;
      break;
    case 'skipped':
      result = `_skipped — ${report.actionLookupStatus.reason}_`;
      break;
    case 'error':
      result = `_error — ${report.actionLookupStatus.message}_`;
      break;
  }
  return result;
}

function formatEntry(entry: ApiLookupEntry): string {
  const wireKey = formatWireKey(entry);
  const heading = entry.specifier === undefined ? `${entry.model}.${entry.verb}` : `${entry.model}.${entry.verb}.${entry.specifier}`;
  const paramsLabel = entry.paramsTypeName ? `\`${entry.paramsTypeName}\`` : '_unresolved_';
  const resultLabel = entry.resultTypeName ? `\`${entry.resultTypeName}\`` : '`void`';
  const lines: string[] = [`## ${heading}`, ''];
  if (entry.description) lines.push(entry.description, '');
  lines.push(`- Wire key: \`${wireKey}\``, `- Params: ${paramsLabel}`, `- Result: ${resultLabel}`, `- Source: \`${entry.sourceFile}:${entry.line}\``, '');

  appendFieldsSection({ lines, label: 'Params', jsDoc: entry.paramsJsDoc, fields: entry.paramsFields });
  appendFieldsSection({ lines, label: 'Result', jsDoc: entry.resultJsDoc, fields: entry.resultFields });
  appendActionMethodSection(lines, entry.action);
  appendActionFactorySection(lines, entry.factory);

  if (!entry.action && !entry.factory && entry.paramsTypeName) {
    lines.push('_(no matching action method or factory resolved by params type)_', '');
  }

  return lines.join('\n').trimEnd();
}

interface AppendFieldsSectionInput {
  readonly lines: string[];
  readonly label: 'Params' | 'Result';
  readonly jsDoc: string | undefined;
  readonly fields: readonly ApiLookupField[];
}

function appendFieldsSection(input: AppendFieldsSectionInput): void {
  const { lines, label, jsDoc, fields } = input;
  if (!jsDoc && fields.length === 0) return;
  lines.push(`### ${label}`);
  if (jsDoc) lines.push('', jsDoc);
  if (fields.length > 0) {
    lines.push('');
    for (const field of fields) lines.push(formatField(field));
  }
  lines.push('');
}

function appendActionMethodSection(lines: string[], action: ApiLookupEntry['action']): void {
  if (!action) return;
  lines.push('### Action method', '', `- \`${action.className}.${action.methodName}\` — \`${action.sourceFile}:${action.line}\``);
  if (action.jsDoc) lines.push('', action.jsDoc);
  lines.push('');
}

function appendActionFactorySection(lines: string[], factory: ApiLookupEntry['factory']): void {
  if (!factory) return;
  lines.push('### Action factory', '', `- \`${factory.factoryName}\` — \`${factory.sourceFile}:${factory.line}\``);
  if (factory.jsDoc) lines.push('', factory.jsDoc);
  lines.push('');
}

function formatWireKey(entry: ApiLookupEntry): string {
  if (entry.verb === 'standalone') {
    return entry.model;
  }
  if (entry.specifier === undefined) {
    return entry.verb;
  }
  return `${entry.verb}:${entry.specifier}`;
}

function formatField(field: ApiLookupField): string {
  const doc = field.jsDoc ? ` — ${field.jsDoc.split('\n')[0]}` : '';
  return `- \`${field.name}: ${field.typeText}\`${doc}`;
}
