import type { AppAssetsReport, AssetReportEntry } from './types.js';

/**
 * Renders the asset listing report as the markdown view the tool
 * returns by default. One section per asset constant plus an
 * aggregator block so callers can scan the full catalog without
 * parsing JSON.
 *
 * @param report - the listing report to render
 * @returns the markdown body
 */
export function formatReportAsMarkdown(report: AppAssetsReport): string {
  const basename = report.componentDir.split('/').pop() ?? report.componentDir;
  const lines: string[] = [`# App assets — ${basename}`, '', `Component: \`${report.componentDir}\``, `App: \`${report.apiDir}\``, '', `\`src/lib/assets.ts\`: ${formatBool(report.assetsFileExists)}`, `Barrel re-exports \`./assets\`: ${formatBool(report.barrelReExportsAssets)}`, `\`provideDbxAssetLoader()\` called in \`src/root.app.config.ts\`: ${formatBool(report.providerWiredInApp)}`, '', `## Assets (${report.assets.length})`];
  if (report.assets.length === 0) {
    lines.push('', '_None found._');
  } else {
    for (const asset of report.assets) {
      lines.push('', formatAssetBlock(asset));
    }
  }
  lines.push('', `## Aggregators (${report.aggregators.length})`);
  if (report.aggregators.length === 0) {
    lines.push('', '_None declared._');
  } else {
    for (const agg of report.aggregators) {
      const members = agg.memberNames.length > 0 ? agg.memberNames.map((n) => `\`${n}\``).join(', ') : '_(empty)_';
      lines.push('', `### \`${agg.symbolName}\` _(line ${agg.line})_`, '', `Members: ${members}`);
    }
  }
  return lines.join('\n');
}

function formatAssetBlock(asset: AssetReportEntry): string {
  const heading = `### \`${asset.symbolName}\``;
  const rows: string[] = [heading];
  rows.push(`- Source type: \`${asset.sourceType}\``);
  rows.push(`- Builder: \`${asset.helper}\``);
  if (asset.resolved !== undefined) {
    rows.push(`- Resolved: \`${asset.resolved}\``);
  } else if (asset.resolvedPaths.length > 0) {
    const list = asset.resolvedPaths.map((p) => `\`${p}\``).join(', ');
    rows.push(`- Resolved paths (${asset.resolvedPaths.length}): ${list}`);
  } else {
    rows.push(`- Resolved: _(could not statically resolve)_`);
  }
  rows.push(`- Source: \`${asset.sourceFile}:${asset.line}\``);
  return rows.join('\n');
}

function formatBool(value: boolean): string {
  return value ? 'yes' : 'no';
}
