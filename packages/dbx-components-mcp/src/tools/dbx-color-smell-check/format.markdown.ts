import type { ColorSmellCheckResult, ColorSmellFinding } from './types.js';

/**
 * Renders the smell-check result as the markdown view the tool returns
 * by default. One section per finding, plus a summary block at the end.
 *
 * @param result - the smell-check output to render
 * @returns the markdown body
 */
export function formatResultAsMarkdown(result: ColorSmellCheckResult): string {
  const lines: string[] = ['# Color smell check', ''];
  lines.push(`Files scanned: ${result.summary.filesScanned}`);
  lines.push(`Literals found: ${result.summary.literalsFound}`);
  lines.push(`Duplicate groups: ${result.summary.duplicateGroups}`);
  if (result.summary.dynamicLiteralsSkipped > 0) {
    lines.push(`Dynamic literals skipped: ${result.summary.dynamicLiteralsSkipped} (spread / computed / non-literal value).`);
  }
  lines.push('', `## Findings (${result.findings.length})`);
  if (result.findings.length === 0) {
    lines.push('', '_No duplicate inline `DbxColorConfig` literals exceeded the threshold._');
  } else {
    for (let i = 0; i < result.findings.length; i += 1) {
      lines.push('', formatFindingBlock(result.findings[i], i + 1));
    }
  }
  return lines.join('\n');
}

function formatFindingBlock(finding: ColorSmellFinding, index: number): string {
  const rows: string[] = [`### ${index}. \`${finding.signature || '(empty)'}\``];
  if (finding.suggestion.existingTemplateKey !== undefined) {
    rows.push(`- Existing template: \`${finding.suggestion.existingTemplateKey}\``);
  } else if (finding.suggestion.proposedTemplateKey !== undefined) {
    rows.push(`- Proposed template key: \`${finding.suggestion.proposedTemplateKey}\``);
  }
  rows.push(`- ${finding.suggestion.rationale}`);
  rows.push(`- Occurrences (${finding.equivalent.length}):`);
  for (const location of finding.equivalent) {
    rows.push(`  - \`${location.file}:${location.line}:${location.column}\` (${location.source}) — \`${location.snippet}\``);
  }
  return rows.join('\n');
}
