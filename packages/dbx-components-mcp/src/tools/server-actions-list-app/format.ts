/**
 * Markdown / JSON renderers for `dbx_server_actions_list_app`.
 */

import type { ServerActionsReport } from './types.js';

/**
 * Renders the report as markdown.
 *
 * @param report - the populated report
 * @returns the formatted markdown text
 */
export function formatReportAsMarkdown(report: ServerActionsReport): string {
  const fixtureStatusLine = report.fixtureStatus !== 'ok' ? `- **Fixture cross-reference:** error reading fixture file: ${report.fixtureStatus.message}` : `- **Fixture cross-reference:** ok`;
  const lines: string[] = [`# Server actions in \`${report.apiDir}\``, '', `- **Classes found:** ${report.entries.length}`, fixtureStatusLine, ''];
  if (report.entries.length === 0) {
    lines.push(`No \`*ServerActions\` abstract classes found under \`${report.modelRoot}\`.`);
    return lines.join('\n').trimEnd();
  }
  lines.push('## Classes', '');
  for (const entry of report.entries) {
    const wiringNote = formatWiring(entry.wiring);
    const barrelNote = entry.exportedFromCommonBarrel ? '✅ exported from `src/app/common/index.ts`' : '⚠️ not exported from `src/app/common/index.ts`';
    lines.push(`### \`${entry.className}\``, '', `- **Source:** \`${entry.sourceFile}\``, `- **NestJS module:** ${wiringNote}`, `- **Barrel:** ${barrelNote}`);
    if (entry.fixtureCoverage) {
      const fc = entry.fixtureCoverage;
      const ifaceNote = fc.contextInterfaceDeclaresGetter ? '✅' : '❌';
      const missingClassList = fc.classesMissingGetter.map((c) => `\`${c}\``).join(', ');
      const classNote = fc.classesMissingGetter.length === 0 ? '✅ all classes implement it' : `⚠️ missing on: ${missingClassList}`;
      lines.push(`- **Fixture context interface declares \`${fc.expectedGetterName}\` getter:** ${ifaceNote}`, `- **Fixture/instance classes implement getter:** ${classNote}`);
    } else {
      lines.push(`- **Fixture coverage:** _unavailable (fixture file unreadable)_`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/**
 * Renders the report as JSON.
 *
 * @param report - the populated report
 * @returns the formatted JSON text
 */
export function formatReportAsJson(report: ServerActionsReport): string {
  return JSON.stringify(report, null, 2);
}

function formatWiring(wiring: { readonly modulePath?: string; readonly providedByModule: boolean; readonly exportedByModule: boolean }): string {
  if (!wiring.modulePath) return '⚠️ no sibling `*.module.ts` file found';
  const status: string[] = [wiring.providedByModule ? '✅ providers' : '❌ not in providers', wiring.exportedByModule ? '✅ exports' : '❌ not in exports'];
  return `\`${wiring.modulePath}\` — ${status.join(' · ')}`;
}
