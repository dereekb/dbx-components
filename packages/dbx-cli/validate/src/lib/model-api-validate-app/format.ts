/**
 * Markdown / JSON renderers for `dbx_model_api_validate_app`.
 */

import { isMcpReadOnlyInferredVerb } from './mcp-read-only.js';
import type { HandlerMcpReadOnlyUnresolved, ReconciledEntry, ValidateReport } from './types.js';

/**
 * Renders the API validation report as a markdown document with per-model sections, status tables, and an issue list.
 *
 * @param report - The validation report to render.
 * @returns A markdown document.
 */
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
    lines.push(`## \`${summary.model}\``, '', `Declared: ${summary.declaredCount} · Handled: ${summary.handledCount} · Matched: ${summary.matchedCount} · Errors: ${summary.errorCount} · Warnings: ${summary.warningCount}`, '', '| Verb | Specifier | Declared | Handler | Status |', '| --- | --- | --- | --- | --- |');
    for (const entry of modelEntries) {
      lines.push(formatEntryRow(entry));
    }
    lines.push('');
  }

  if (report.issues.length > 0) {
    lines.push('## Issues', '');
    for (const issue of report.issues) {
      const verbSuffix = issue.verb ? `.${issue.verb}` : '';
      const specifierSuffix = issue.specifier ? `.${issue.specifier}` : '';
      const severitySuffix = issue.severity === 'warning' ? ' _(warning)_' : '';
      lines.push(`- **${issue.code}**${severitySuffix} \`${issue.model}${verbSuffix}${specifierSuffix}\` — ${issue.message}`);
    }
    lines.push('');
  }

  lines.push(...formatMcpReadOnlyNotChecked(report));
  return lines.join('\n');
}

/**
 * Renders the "not checked" section: the `invoke` / custom-verb handlers the scan could not follow back to a literal
 * `withApiDetails({ ... })`, so `HANDLER_MCP_READ_ONLY_UNSET` was not checked for them.
 *
 * @param report - The validation report.
 * @returns The section's lines, or none when every such handler was read.
 */
function formatMcpReadOnlyNotChecked(report: ValidateReport): string[] {
  const lines: string[] = [];
  for (const entry of report.entries) {
    const handler = entry.handler;
    const status = handler?.mcpReadOnly;
    if (handler && status?.kind === 'unresolved' && !isMcpReadOnlyInferredVerb(entry.verb)) {
      const specifierSuffix = entry.specifier ? `.${entry.specifier}` : '';
      lines.push(`- \`${entry.model}.${entry.verb}${specifierSuffix}\` → \`${handler.handlerName}\` — ${formatUnresolvedReason(status)}`);
    }
  }
  if (lines.length > 0) {
    lines.unshift('## MCP read/write classification not checked', '', 'The scan could not follow these handlers back to a literal `withApiDetails({ ... })`, so `HANDLER_MCP_READ_ONLY_UNSET` was not checked for them:', '');
    lines.push('');
  }
  return lines;
}

function formatUnresolvedReason(status: HandlerMcpReadOnlyUnresolved): string {
  return status.declarationSource ? `${status.reason} (\`${status.declarationSource}\`)` : status.reason;
}

/**
 * Renders the API validation report as a flat JSON payload.
 *
 * @param report - The validation report to render.
 * @returns Pretty-printed JSON string for the report.
 */
export function formatValidationAsJson(report: ValidateReport): string {
  return JSON.stringify(report, null, 2);
}

function formatHandlerMapStatus(report: ValidateReport): string {
  let result: string;
  switch (report.handlerMapStatus.kind) {
    case 'ok': {
      if (report.handlerMapStatus.verbsFound.length === 0) {
        result = 'Verbs found: _(none)_';
      } else {
        const verbs = report.handlerMapStatus.verbsFound.map((v) => `\`${v}\``).join(', ');
        result = `Verbs found: ${verbs}`;
      }
      break;
    }
    case 'missing':
      result = `_Handler map not found at \`${report.handlerMapStatus.path}\` — every declared call will be flagged as MISSING HANDLER._`;
      break;
    case 'error':
      result = `_Handler map parse error: ${report.handlerMapStatus.message}_`;
      break;
  }
  return result;
}

function entryStatus(entry: ReconciledEntry): string {
  if (entry.declared && entry.handler) return 'matched';
  if (entry.declared) return 'MISSING HANDLER';
  return 'ORPHAN HANDLER';
}

function formatEntryRow(entry: ReconciledEntry): string {
  const verb = `\`${entry.verb}\``;
  const specifier = entry.specifier === undefined ? '—' : `\`${entry.specifier}\``;
  const declared = entry.declared ? `\`${entry.declared.paramsTypeName ?? '?'}\` (\`${entry.declared.sourceFile}:${entry.declared.line}\`)` : '—';
  const handler = entry.handler ? `\`${entry.handler.handlerName}\`` : '—';
  const status = entryStatus(entry);
  return `| ${verb} | ${specifier} | ${declared} | ${handler} | ${status} |`;
}
