/**
 * Markdown renderers for the four `dbx_mcp_config` ops.
 *
 * Mirrors the severity-grouped report style used by `dbx_app_validate`:
 * a single H1 with the workspace label, then per-section H2s. Each op gets
 * its own renderer so the wording stays specific to the op's purpose.
 */

import { DOWNSTREAM_CLUSTERS, type DownstreamCluster } from '../../scan/discover-downstream-packages.js';
import type { InitPlan } from './init.js';
import type { RefreshOutcome, RefreshResult } from './refresh.js';
import type { PackageSnapshot, WorkspaceSnapshot } from './snapshot.js';

/**
 * Display label for each cluster.
 */
const CLUSTER_LABEL: Record<DownstreamCluster, string> = {
  semanticTypes: 'Semantic types',
  uiComponents: 'UI components',
  forgeFields: 'Forge fields',
  pipes: 'Pipes',
  actions: 'Actions',
  filters: 'Filters'
};

/**
 * `dbx_mcp_config op="status"` renderer.
 *
 * @param snapshot - the workspace snapshot to render
 * @returns markdown text consumed by the tool result
 */
export function formatStatus(snapshot: WorkspaceSnapshot): string {
  const lines: string[] = [];
  lines.push(`# dbx-mcp config status`);
  lines.push('');
  lines.push(`- **Workspace:** \`${snapshot.workspaceRoot}\``);
  const configLabel = snapshot.configPath !== null ? `\`${snapshot.configPath}\`` : '_not present_';
  lines.push(`- **Config file:** ${configLabel}`);
  lines.push(`- **Downstream packages:** ${snapshot.packages.length}`);
  lines.push('');

  if (snapshot.configWarnings.length > 0) {
    lines.push(`## Config warnings`);
    lines.push('');
    for (const w of snapshot.configWarnings) {
      lines.push(`- **${w.kind}** \`${w.path}\` — ${w.error}`);
    }
    lines.push('');
  }

  for (const cluster of DOWNSTREAM_CLUSTERS) {
    const sources = snapshot.registeredSources.filter((s) => s.cluster === cluster);
    const candidatePackages = snapshot.packages.filter((ps) => ps.pkg.candidateClusters.includes(cluster) && ps.registeredClusters.get(cluster) !== true);
    const anyContent = sources.length + candidatePackages.length;
    if (anyContent === 0) continue;

    lines.push(`## ${CLUSTER_LABEL[cluster]}`);
    lines.push('');
    if (sources.length > 0) {
      lines.push(`**Registered sources:**`);
      for (const s of sources) {
        lines.push(`- \`${s.relativePath}\` ${s.exists ? '✓' : '✗ missing'}`);
      }
      lines.push('');
    }
    if (candidatePackages.length > 0) {
      lines.push(`**Candidate packages without registration:**`);
      for (const ps of candidatePackages) {
        lines.push(`- \`${ps.pkg.relDir}\` (${ps.pkg.packageName})`);
      }
      lines.push('');
    }
  }

  if (snapshot.packages.length > 0) {
    lines.push(`## Packages`);
    lines.push('');
    for (const ps of snapshot.packages) {
      lines.push(formatPackageBullet(ps));
    }
    lines.push('');
  }

  if (hasUnregisteredCandidates(snapshot)) {
    lines.push(`## Next steps`);
    lines.push('');
    lines.push('Run `dbx_mcp_config op="init"` to write conventional defaults, then `op="refresh"` to populate `.tmp/dbx-mcp/`.');
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * `dbx_mcp_config op="validate"` renderer. Errors-only.
 *
 * @param snapshot - the workspace snapshot to validate
 * @returns markdown text plus an `hasErrors` flag the tool maps to `isError`
 */
export function formatValidate(snapshot: WorkspaceSnapshot): { readonly text: string; readonly hasErrors: boolean } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const w of snapshot.configWarnings) {
    errors.push(`**${w.kind}** \`${w.path}\` — ${w.error}`);
  }
  for (const s of snapshot.registeredSources) {
    if (!s.exists) errors.push(`Registered ${s.cluster} source \`${s.relativePath}\` does not exist on disk.`);
  }
  for (const ps of snapshot.packages) {
    for (const cluster of ps.pkg.candidateClusters) {
      if (ps.registeredClusters.get(cluster) !== true) {
        warnings.push(`Package \`${ps.pkg.relDir}\` looks like it provides ${CLUSTER_LABEL[cluster]} but no source is registered.`);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`# dbx-mcp config validation`);
  lines.push('');
  lines.push(`- **Workspace:** \`${snapshot.workspaceRoot}\``);
  lines.push(`- **Errors:** ${errors.length}`);
  lines.push(`- **Warnings:** ${warnings.length}`);
  lines.push('');

  if (errors.length > 0) {
    lines.push(`## Errors`);
    lines.push('');
    for (const e of errors) lines.push(`- ${e}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push('');
    for (const w of warnings) lines.push(`- ${w}`);
    lines.push('');
  }
  if (errors.length === 0 && warnings.length === 0) {
    lines.push(`No issues detected.`);
    lines.push('');
  }

  return { text: lines.join('\n').trimEnd() + '\n', hasErrors: errors.length > 0 };
}

/**
 * `dbx_mcp_config op="init"` renderer.
 *
 * @param plan - the planned set of changes from `buildInitPlan`
 * @param opts - render options
 * @param opts.dryRun - when true, the heading and section labels reflect "would be written"
 * @returns markdown text consumed by the tool result
 */
export function formatInit(plan: InitPlan, opts: { readonly dryRun: boolean }): string {
  const newCount = plan.changes.filter((c) => c.reason === 'new').length;
  const updated = plan.changes.filter((c) => c.reason === 'updated').length;
  const unchanged = plan.changes.filter((c) => c.reason === 'unchanged').length;

  const lines: string[] = [];
  lines.push(`# dbx-mcp config init${opts.dryRun ? ' (dry run)' : ''}`);
  lines.push('');
  lines.push(`- **Workspace:** \`${plan.workspaceRoot}\``);
  lines.push(`- **New files:** ${newCount}`);
  lines.push(`- **Updated:** ${updated}`);
  lines.push(`- **Unchanged:** ${unchanged}`);
  lines.push('');

  if (plan.changes.length === 0) {
    lines.push('No changes needed.');
    lines.push('');
    return lines.join('\n').trimEnd() + '\n';
  }

  const writeable = plan.changes.filter((c) => c.reason !== 'unchanged');
  if (writeable.length > 0) {
    lines.push(opts.dryRun ? `## Files that would be written` : `## Files written`);
    lines.push('');
    for (const change of writeable) {
      lines.push(`- **${change.reason}** \`${change.relativePath}\``);
    }
    lines.push('');
  }

  if (!opts.dryRun) {
    lines.push(`## Next steps`);
    lines.push('');
    lines.push('Run `dbx_mcp_config op="refresh"` to populate `.tmp/dbx-mcp/` with the generated manifests.');
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * `dbx_mcp_config op="refresh"` renderer.
 *
 * @param result - per-package, per-cluster refresh outcomes
 * @returns markdown text plus a `hasFailures` flag the tool maps to `isError`
 */
export function formatRefresh(result: RefreshResult): { readonly text: string; readonly hasFailures: boolean } {
  const lines: string[] = [];
  const ok = result.outcomes.filter((o) => o.kind === 'ok');
  const fail = result.outcomes.filter((o) => o.kind === 'fail');
  const error = result.outcomes.filter((o) => o.kind === 'error');

  lines.push(`# dbx-mcp config refresh`);
  lines.push('');
  lines.push(`- **Manifests refreshed:** ${ok.length}`);
  lines.push(`- **Failures:** ${fail.length + error.length}`);
  lines.push('');

  if (ok.length > 0) {
    lines.push(`## Refreshed`);
    lines.push('');
    for (const o of ok) lines.push(`- \`${o.packageRelDir}\` · ${CLUSTER_LABEL[o.cluster]}`);
    lines.push('');
  }
  if (fail.length > 0) {
    lines.push(`## Scan failures`);
    lines.push('');
    for (const o of fail) {
      lines.push(`- \`${o.packageRelDir}\` · ${CLUSTER_LABEL[o.cluster]} (exit ${o.exitCode})`);
      for (const line of o.stderr.slice(0, 5)) lines.push(`    ${line}`);
    }
    lines.push('');
  }
  if (error.length > 0) {
    lines.push(`## Runtime errors`);
    lines.push('');
    for (const o of error) {
      lines.push(`- \`${o.packageRelDir}\` · ${CLUSTER_LABEL[o.cluster]} — ${(o as Extract<RefreshOutcome, { kind: 'error' }>).message}`);
    }
    lines.push('');
  }

  if (result.outcomes.length === 0) {
    lines.push('Nothing to refresh — no downstream package has a `dbx-mcp.scan.json` with declared clusters.');
    lines.push('Run `dbx_mcp_config op="init"` first if defaults are missing.');
    lines.push('');
  }

  return { text: lines.join('\n').trimEnd() + '\n', hasFailures: fail.length + error.length > 0 };
}

function formatPackageBullet(ps: PackageSnapshot): string {
  const labels: string[] = [];
  for (const cluster of ps.pkg.candidateClusters) {
    const registered = ps.registeredClusters.get(cluster) === true;
    labels.push(`${CLUSTER_LABEL[cluster]}${registered ? '✓' : ''}`);
  }
  const labelPart = labels.length > 0 ? labels.join(', ') : '_no candidate clusters_';
  const scanPart = ps.pkg.hasScanConfig ? ' · scan-config ✓' : '';
  return `- \`${ps.pkg.relDir}\` · ${ps.pkg.packageName} · ${labelPart}${scanPart}`;
}

function hasUnregisteredCandidates(snapshot: WorkspaceSnapshot): boolean {
  for (const ps of snapshot.packages) {
    for (const cluster of ps.pkg.candidateClusters) {
      if (ps.registeredClusters.get(cluster) !== true) return true;
    }
  }
  return false;
}
