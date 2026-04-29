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
  const lines: string[] = [];
  lines.push(`# Server actions in \`${report.apiDir}\``, '');
  lines.push(`- **Classes found:** ${report.entries.length}`);
  if (report.fixtureStatus !== 'ok') {
    lines.push(`- **Fixture cross-reference:** error reading fixture file: ${report.fixtureStatus.message}`);
  } else {
    lines.push(`- **Fixture cross-reference:** ok`);
  }
  lines.push('');
  if (report.entries.length === 0) {
    lines.push(`No \`*ServerActions\` abstract classes found under \`${report.modelRoot}\`.`);
    return lines.join('\n').trimEnd();
  }
  lines.push('## Classes', '');
  for (const entry of report.entries) {
    const wiringNote = formatWiring(entry.wiring);
    const barrelNote = entry.exportedFromCommonBarrel ? '✅ exported from `src/app/common/index.ts`' : '⚠️ not exported from `src/app/common/index.ts`';
    lines.push(`### \`${entry.className}\``, '');
    lines.push(`- **Source:** \`${entry.sourceFile}\``);
    lines.push(`- **NestJS module:** ${wiringNote}`);
    lines.push(`- **Barrel:** ${barrelNote}`);
    if (entry.fixtureCoverage) {
      const fc = entry.fixtureCoverage;
      const ifaceNote = fc.contextInterfaceDeclaresGetter ? '✅' : '❌';
      const classNote = fc.classesMissingGetter.length === 0 ? '✅ all classes implement it' : `⚠️ missing on: ${fc.classesMissingGetter.map((c) => `\`${c}\``).join(', ')}`;
      lines.push(`- **Fixture context interface declares \`${fc.expectedGetterName}\` getter:** ${ifaceNote}`);
      lines.push(`- **Fixture/instance classes implement getter:** ${classNote}`);
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
  const status: string[] = [];
  status.push(wiring.providedByModule ? '✅ providers' : '❌ not in providers');
  status.push(wiring.exportedByModule ? '✅ exports' : '❌ not in exports');
  return `\`${wiring.modulePath}\` — ${status.join(' · ')}`;
}
