import type { ColorTemplateConfig, ColorTemplateEntry, ColorTemplateListAppReport } from './types.js';

/**
 * Renders the color-templates report as the markdown view the tool
 * returns by default. One block per template plus a warnings section
 * so callers can scan the catalog without parsing JSON.
 *
 * @param report - the listing report to render
 * @returns the markdown body
 */
export function formatReportAsMarkdown(report: ColorTemplateListAppReport): string {
  const lines: string[] = [`# Color templates — ${report.apiDir}`, '', `App: \`${report.apiDir}\``];
  if (report.provideCallLocation === undefined) {
    lines.push('`provideDbxStyleService(...)`: _not found in any root config file_');
  } else {
    lines.push(`\`provideDbxStyleService(...)\`: \`${report.provideCallLocation.file}:${report.provideCallLocation.line}\``);
  }
  lines.push('', `## Templates (${report.templates.length})`);
  if (report.templates.length === 0) {
    lines.push('', '_None registered._');
    if (report.provideCallLocation === undefined) {
      lines.push('', 'Wire `provideDbxStyleService({ dbxColorServiceConfig: { templates: [...] } })` in `src/root.app.config.ts` to register named color presets.');
    }
  } else {
    for (const template of report.templates) {
      lines.push('', formatTemplateBlock(template));
    }
  }
  lines.push('', `## Warnings (${report.warnings.length})`);
  if (report.warnings.length === 0) {
    lines.push('', '_None._');
  } else {
    for (const warning of report.warnings) {
      lines.push(`- \`${warning.file}:${warning.line}\` — ${warning.message}`);
    }
  }
  return lines.join('\n');
}

function formatTemplateBlock(template: ColorTemplateEntry): string {
  const heading = `### \`${template.key}\``;
  const rows: string[] = [heading, `- Config: ${formatConfigInline(template.config)}`, `- Source: \`${template.sourceFile}:${template.sourceLine}\``];
  return rows.join('\n');
}

function formatConfigInline(config: ColorTemplateConfig): string {
  const parts: string[] = [];
  if (config.template !== undefined) parts.push(`template=\`${config.template}\``);
  if (config.color !== undefined) parts.push(`color=\`${config.color}\``);
  if (config.contrast !== undefined) parts.push(`contrast=\`${config.contrast}\``);
  if (config.tone !== undefined) parts.push(`tone=\`${config.tone}\``);
  if (config.tonal !== undefined) parts.push(`tonal=\`${config.tonal}\``);
  return parts.length === 0 ? '_(empty)_' : parts.join(', ');
}
