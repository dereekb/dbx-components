/**
 * Markdown renderer for `dbx_system_m_list_app`.
 */

import type { SystemMListAppReport } from './types.js';

const STATUS_LABEL = {
  ok: '✅ ok',
  'not-found': '❌ folder not found',
  'not-directory': '❌ path is not a directory'
} as const;

/**
 * Renders the listing report as a markdown document with a summary
 * header plus a per-state table covering data interface, converter,
 * and converter-map presence.
 *
 * @param report - the listing report to render
 * @returns the markdown document
 */
export function formatReportAsMarkdown(report: SystemMListAppReport): string {
  const lines: string[] = [`# System state listing — \`${report.componentDir}\``, '', `Folder: \`${report.folderPath}\``, `Status: ${STATUS_LABEL[report.status]}`];
  if (report.converterMapName !== undefined) {
    lines.push(`Converter map: \`${report.converterMapName}\``);
  }
  lines.push('');

  if (report.status !== 'ok') {
    lines.push(`_No state types listed — the system folder is not accessible._`);
    return lines.join('\n').trimEnd();
  }
  if (!report.hasSystemSource) {
    lines.push(`_The system folder exists but \`system.ts\` is missing or unreadable._`);
    return lines.join('\n').trimEnd();
  }
  if (report.pairings.length === 0) {
    lines.push(`_No \`*_SYSTEM_STATE_TYPE\` constants are declared in \`system.ts\`._`);
    return lines.join('\n').trimEnd();
  }

  const complete = report.pairings.filter((p) => p.complete).length;
  lines.push(`State types: ${report.pairings.length} declared · ${complete} fully wired`, '', '| Type constant | Data interface | Converter | In map | Status |', '| --- | --- | --- | --- | --- |');
  for (const pairing of report.pairings) {
    const dataCell = pairing.dataInterface === undefined ? '_(missing)_' : `\`${pairing.dataInterface.name}\``;
    const converterCell = pairing.converter === undefined ? '_(missing)_' : `\`${pairing.converter.name}\``;
    const mapCell = pairing.inConverterMap ? '✅' : '❌';
    const status = pairing.complete ? '✅' : '⚠️';
    lines.push(`| \`${pairing.typeConstant.name}\` | ${dataCell} | ${converterCell} | ${mapCell} | ${status} |`);
  }
  lines.push('', `→ Run \`dbx_system_m_validate_folder\` on this folder to see the exact rules that are firing.`);
  return lines.join('\n').trimEnd();
}
