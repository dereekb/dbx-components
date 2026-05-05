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
  switch (report.actionLookupStatus.kind) {
    case 'ok':
      return `scanned ${report.actionLookupStatus.filesScanned} \`*.action.server.ts\` file(s)`;
    case 'skipped':
      return `_skipped — ${report.actionLookupStatus.reason}_`;
    case 'error':
      return `_error — ${report.actionLookupStatus.message}_`;
  }
}

function formatEntry(entry: ApiLookupEntry): string {
  const wireKey = formatWireKey(entry);
  const heading = entry.specifier !== undefined ? `${entry.model}.${entry.verb}.${entry.specifier}` : `${entry.model}.${entry.verb}`;
  const paramsLabel = entry.paramsTypeName ? `\`${entry.paramsTypeName}\`` : '_unresolved_';
  const resultLabel = entry.resultTypeName ? `\`${entry.resultTypeName}\`` : '`void`';
  const lines: string[] = [`## ${heading}`, '', `- Wire key: \`${wireKey}\``, `- Params: ${paramsLabel}`, `- Result: ${resultLabel}`, `- Source: \`${entry.sourceFile}:${entry.line}\``, ''];

  if (entry.paramsJsDoc || entry.paramsFields.length > 0) {
    lines.push('### Params');
    if (entry.paramsJsDoc) {
      lines.push('', entry.paramsJsDoc);
    }
    if (entry.paramsFields.length > 0) {
      lines.push('');
      for (const field of entry.paramsFields) {
        lines.push(formatField(field));
      }
    }
    lines.push('');
  }

  if (entry.resultJsDoc || entry.resultFields.length > 0) {
    lines.push('### Result');
    if (entry.resultJsDoc) {
      lines.push('', entry.resultJsDoc);
    }
    if (entry.resultFields.length > 0) {
      lines.push('');
      for (const field of entry.resultFields) {
        lines.push(formatField(field));
      }
    }
    lines.push('');
  }

  if (entry.action) {
    lines.push('### Action method', '', `- \`${entry.action.className}.${entry.action.methodName}\` — \`${entry.action.sourceFile}:${entry.action.line}\``);
    if (entry.action.jsDoc) {
      lines.push('', entry.action.jsDoc);
    }
    lines.push('');
  }

  if (entry.factory) {
    lines.push('### Action factory', '', `- \`${entry.factory.factoryName}\` — \`${entry.factory.sourceFile}:${entry.factory.line}\``);
    if (entry.factory.jsDoc) {
      lines.push('', entry.factory.jsDoc);
    }
    lines.push('');
  }

  if (!entry.action && !entry.factory && entry.paramsTypeName) {
    lines.push('_(no matching action method or factory resolved by params type)_', '');
  }

  return lines.join('\n').trimEnd();
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
