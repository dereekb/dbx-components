/**
 * Markdown / JSON formatters for `dbx_model_list_component`.
 */

import type { ComponentModelReport } from './types.js';

/**
 * Renders the listing report as markdown.
 *
 * @param report - the listing report
 * @returns the formatted markdown text
 */
export function formatReportAsMarkdown(report: ComponentModelReport): string {
  const lines: string[] = [];
  lines.push(`# Models in \`${report.componentDir}\``, '');
  lines.push(`- **Models found:** ${report.models.length}`);
  lines.push(`- **Reserved folders skipped:** ${report.skipped.length}`);
  if (report.unidentifiedFolders.length > 0) {
    const unidentifiedFolderList = report.unidentifiedFolders.map((f) => `\`${f}\``).join(', ');
    lines.push(`- **Folders without detectable identity:** ${report.unidentifiedFolders.length} (${unidentifiedFolderList})`);
  }
  lines.push(`- **Fixture coverage:** ${formatCoverageStatus(report)}`);
  lines.push('');

  if (report.models.length === 0) {
    lines.push(`No models found under \`${report.modelRoot}\`.`);
  } else {
    lines.push('## Models', '');
    for (const m of report.models) {
      const parent = m.parentIdentityConst ? ` · subcollection of \`${m.parentIdentityConst}\`` : '';
      const fixtureNote = m.fixtureCovered === undefined ? '' : m.fixtureCovered ? ' · ✅ fixture' : ' · ❌ no fixture';
      lines.push(`### \`${m.modelName}\`${parent}${fixtureNote}`, '');
      lines.push(`- **Folder:** \`${m.folder}\``);
      lines.push(`- **Identity:** \`${m.identityConst ?? '<not detected>'}\``);
      if (m.collectionName) lines.push(`- **Collection:** \`${m.collectionName}\` · prefix \`${m.collectionPrefix ?? '<not detected>'}\``);
      lines.push(`- **Source:** \`${m.sourceFile}\``);
      lines.push('');
    }
  }

  if (report.skipped.length > 0) {
    lines.push('## Reserved folders skipped', '');
    for (const s of report.skipped) {
      lines.push(`- \`${s.folder}\` → use \`${s.recommendedTool}\``);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/**
 * Renders the listing report as JSON.
 *
 * @param report - the listing report
 * @returns the formatted JSON text
 */
export function formatReportAsJson(report: ComponentModelReport): string {
  return JSON.stringify(report, null, 2);
}

function formatCoverageStatus(report: ComponentModelReport): string {
  if (report.fixtureCoverageStatus === 'no-api-dir') return '_skipped — pass `apiDir` to enable_';
  if (report.fixtureCoverageStatus === 'ok') {
    const covered = report.models.filter((m) => m.fixtureCovered).length;
    const total = report.models.length;
    return `${covered}/${total} models have a fixture context`;
  }
  return `error reading fixture file: ${report.fixtureCoverageStatus.message}`;
}
