/**
 * Markdown / JSON renderers for `dbx_model_test_hotspots`.
 *
 * The markdown renderer leads with the actionable answer — "extend these
 * existing crud/scenario specs" or "none exist, create these canonical files" —
 * so the response directly counters the failure mode of concluding a model has
 * no spec to extend from a filename search.
 */

import type { ModelTestHotspot, ModelTestHotspotsResult, SpecBucket } from './hotspots.js';

const BUCKET_ORDER: readonly SpecBucket[] = ['crud', 'scenario', 'other'];

const BUCKET_LABEL: Record<SpecBucket, string> = {
  crud: 'CRUD specs',
  scenario: 'Scenario specs',
  other: 'Other specs'
};

/**
 * Maximum matched-fixture lines rendered per hotspot file (the rest are
 * summarised by the ref counts).
 */
const MAX_HITS_PER_FILE = 3;

/**
 * Renders the hotspots result as a JSON string (two-space indent).
 *
 * @param result - The hotspots result.
 * @returns The JSON body.
 */
export function formatHotspotsAsJson(result: ModelTestHotspotsResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Renders the hotspots result as markdown.
 *
 * @param result - The hotspots result.
 * @returns The markdown body.
 */
export function formatHotspotsAsMarkdown(result: ModelTestHotspotsResult): string {
  const lines: string[] = [];
  lines.push(`# Model-test hotspots — \`${result.model}\` (${result.apiRel})`, '', fixtureLine(result));
  if (result.hotspots.length > 0) {
    appendHotspotSections(lines, result);
  } else {
    appendNoHotspots(lines, result);
  }
  appendConventionNote(lines);
  return lines.join('\n');
}

function fixtureLine(result: ModelTestHotspotsResult): string {
  const parents = result.parentModels.length > 0 ? result.parentModels.map(code).join(' → ') : '_none_';
  const fixture = result.fixtureFound ? `Fixture: found · Parents: ${parents}` : `Fixture: _not found_ — matching by model name only`;
  return `${fixture}\nGroup: ${code(result.group)}${result.groupMatchedExisting ? '' : ' _(inferred — no existing folder matched)_'}`;
}

function appendHotspotSections(lines: string[], result: ModelTestHotspotsResult): void {
  const parentNote = result.parentModels.length > 0 ? ' or a parent fixture' : '';
  lines.push('', `**${result.hotspots.length} existing spec file(s)** reference ${code(result.model)}'s fixture${parentNote} — extend these rather than assuming none exist:`);
  for (const bucket of BUCKET_ORDER) {
    const inBucket = result.hotspots.filter((hotspot) => hotspot.bucket === bucket);
    if (inBucket.length > 0) {
      lines.push('', `## ${BUCKET_LABEL[bucket]}`);
      for (const hotspot of inBucket) {
        appendHotspot(lines, hotspot);
      }
    }
  }
}

function appendHotspot(lines: string[], hotspot: ModelTestHotspot): void {
  lines.push('', `- ${code(hotspot.fileRel)} — direct ${hotspot.directRefs} · via-parent ${hotspot.parentRefs}`);
  for (const hit of hotspot.hits.slice(0, MAX_HITS_PER_FILE)) {
    const under = hit.fixtureChain.length > 0 ? ` under ${hit.fixtureChain.join(' › ')}` : '';
    const describe = hit.describePath.length > 0 ? hit.describePath.join(' › ') : '(top level)';
    lines.push(`  - L${hit.line} · fixture ${code(hit.model ?? '?')}${under} · ${describe}`);
  }
}

function appendNoHotspots(lines: string[], result: ModelTestHotspotsResult): void {
  const parentNote = result.parentModels.length > 0 ? ' or a parent fixture' : '';
  lines.push('', `No existing spec references ${code(result.model)}'s fixture${parentNote}.`);
  const groupNote = result.groupMatchedExisting ? `group ${code(result.group)}` : `inferred group ${code(result.group)}`;
  lines.push('', `Create the canonical default spec file(s) for ${groupNote}:`);
  for (const file of result.suggestedFiles) {
    lines.push(`- ${code(file)}`);
  }
}

function appendConventionNote(lines: string[]): void {
  lines.push('', '---', 'API integration specs are grouped by model **group**, not named per-model: `<group>.crud[.<sub>].spec.ts` + `<group>.scenario[.<sub>].spec.ts`, reusing the group fixture chain.');
}

function code(value: string): string {
  return '`' + value + '`';
}
