/**
 * Markdown / JSON renderers for `dbx_model_test_list_app`.
 *
 * The renderer takes a {@link DiscoveredSpecCatalog} and produces a per-group
 * listing plus a "Where to add a new test" guidance block and a consolidated
 * drift report. Output is intentionally compact so the answer to "what's
 * already here and where do I add the next one?" lives in a single response.
 */

import { CANONICAL_KINDS, recommendBucketsForGroup, type SpecBucketRecommendation, type SpecFileKind } from '@dereekb/util';
import type { DiscoveredSpecCatalog, DiscoveredSpecFile, DiscoveredSpecGroup } from './discover.js';

const KIND_LABEL: Record<SpecFileKind, string> = {
  crud: 'crud',
  'crud-subgroup': 'crud.<sub>',
  scenario: 'scenario',
  'scenario-subgroup': 'scenario.<sub>',
  'crud-misplaced': '⚠ crud-misplaced',
  'scenario-misplaced': '⚠ scenario-misplaced',
  'no-bucket': '⚠ no-bucket',
  'non-spec': 'non-spec',
  'non-group': 'non-group'
};

/**
 * Renders the list-app report as markdown.
 *
 * @param catalog - The discovered, classified catalog.
 * @param filter - Optional caller-supplied filter — surfaced in the heading
 *   so the reader knows the listing is scoped.
 * @param filter.group - When set, the rendered heading notes that only this
 *   model group is shown. The catalog itself is already pre-filtered.
 * @returns The markdown body.
 */
export function formatListAppAsMarkdown(catalog: DiscoveredSpecCatalog, filter?: { readonly group?: string }): string {
  const lines: string[] = [];
  appendListAppHeader(lines, catalog, filter);
  if (catalog.groups.length === 0) {
    lines.push('', '_No spec files discovered under `' + catalog.functionDirRel + '`._');
    return lines.join('\n');
  }
  for (const group of catalog.groups) {
    appendGroupSection(lines, catalog.apiRel, group);
  }
  appendConventionLegend(lines);
  appendDriftSummary(lines, catalog);
  return lines.join('\n');
}

/**
 * Renders the list-app report as a JSON string (one shape suitable for
 * automation). Pretty-printed with two-space indent so diffs stay readable.
 *
 * @param catalog - The discovered, classified catalog.
 * @returns The JSON body.
 */
export function formatListAppAsJson(catalog: DiscoveredSpecCatalog): string {
  const groupsPayload = catalog.groups.map((group) => ({
    group: group.group,
    folderRel: group.folderRel,
    recommendations: recommendBucketsForGroup({ apiDir: catalog.apiRel, group: group.group }),
    files: group.files.map((file) => ({
      filename: file.filename,
      fileRel: file.fileRel,
      kind: file.classification.kind,
      group: file.classification.group,
      subgroups: file.classification.subgroups,
      isCanonical: file.classification.isCanonical,
      recommendedRename: file.classification.recommendedRename,
      driftReason: file.classification.driftReason
    }))
  }));
  const payload = {
    apiRel: catalog.apiRel,
    functionDirRel: catalog.functionDirRel,
    totalSpecFiles: catalog.totalSpecFiles,
    totalDriftFiles: catalog.totalDriftFiles,
    canonicalKinds: CANONICAL_KINDS,
    groups: groupsPayload
  };
  return JSON.stringify(payload, null, 2);
}

function appendListAppHeader(lines: string[], catalog: DiscoveredSpecCatalog, filter?: { readonly group?: string }): void {
  lines.push(`# Model-test spec files — ${catalog.apiRel}`, '', `Function-tests root: \`${catalog.functionDirRel}\``);
  if (filter?.group) lines.push(`Filter — group: \`${filter.group}\``);
  lines.push(`Groups: ${catalog.groups.length} · Files: ${catalog.totalSpecFiles} · Drift: ${catalog.totalDriftFiles}`);
}

function appendGroupSection(lines: string[], apiRel: string, group: DiscoveredSpecGroup): void {
  lines.push('', `## ${group.group}`, '', `Folder: \`${group.folderRel}\``);
  appendFileTable(lines, group);
  appendWhereToAddSection(lines, apiRel, group);
}

function appendFileTable(lines: string[], group: DiscoveredSpecGroup): void {
  lines.push('', '| File | Kind | Subgroups | Canonical | Rename suggestion |', '|---|---|---|---|---|');
  for (const file of group.files) {
    lines.push('| ' + [code(file.filename), KIND_LABEL[file.classification.kind], file.classification.subgroups.length === 0 ? '—' : code(file.classification.subgroups.join('.')), file.classification.isCanonical ? '✓' : '✗', file.classification.recommendedRename === undefined ? '—' : code(file.classification.recommendedRename)].join(' | ') + ' |');
  }
}

function appendWhereToAddSection(lines: string[], apiRel: string, group: DiscoveredSpecGroup): void {
  lines.push('', `### Where to add a new test for \`${group.group}\``);
  const recommendations = recommendBucketsForGroup({ apiDir: apiRel, group: group.group });
  for (const rec of recommendations) {
    appendRecommendation(lines, rec, group);
  }
}

function appendRecommendation(lines: string[], rec: SpecBucketRecommendation, group: DiscoveredSpecGroup): void {
  const existing = group.files.find((file) => file.filename === basename(rec.canonicalPath) && file.classification.isCanonical);
  const status = existing === undefined ? '_(new file)_' : `_(exists — ${existing.fileRel})_`;
  lines.push('', `- **${rec.label}** → \`${rec.canonicalPath}\` ${status}`, `  ${rec.summary}`);
}

function appendConventionLegend(lines: string[]): void {
  lines.push('', '## Naming convention', '', '- `<group>.crud.spec.ts` — non-scenario CRUD tests.', '- `<group>.crud.<sub>[.<sub>...].spec.ts` — focused CRUD sub-test.', '- `<group>.scenario.spec.ts` — generic multi-step scenario tests.', '- `<group>.scenario.<sub>[.<sub>...].spec.ts` — focused scenario sub-bucket.', '', 'Drift forms are still parsed but flagged — see the `Rename suggestion` column.');
}

function appendDriftSummary(lines: string[], catalog: DiscoveredSpecCatalog): void {
  const driftFiles: { readonly group: string; readonly file: DiscoveredSpecFile }[] = [];
  for (const group of catalog.groups) {
    for (const file of group.files) {
      if (!file.classification.isCanonical && file.classification.kind !== 'non-spec' && file.classification.kind !== 'non-group') {
        driftFiles.push({ group: group.group, file });
      }
    }
  }
  if (driftFiles.length === 0) {
    lines.push('', '## Drift', '', '_All spec files match the canonical convention._');
    return;
  }
  lines.push('', `## Drift (${driftFiles.length})`);
  for (const entry of driftFiles) {
    const c = entry.file.classification;
    lines.push('', `- \`${entry.file.fileRel}\` — ${c.driftReason ?? 'Off-convention.'} Suggested: \`${c.recommendedRename ?? '(none)'}\`.`);
  }
}

function code(value: string): string {
  return '`' + value + '`';
}

function basename(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx === -1 ? p : p.slice(idx + 1);
}
