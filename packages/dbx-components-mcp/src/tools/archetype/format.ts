/**
 * Markdown formatters for the `dbx_model_archetype_*` tool cluster.
 *
 * The recommender's primary output renders the matched archetype with its
 * derived axes, the implied collection kind, the implementation pointers, a
 * peer-model table (queried from the registry), and an "Alternatives
 * considered" section. The lookup tool reuses {@link formatArchetypeEntry}.
 */

import { type FirebaseModel, type ModelArchetypeInfo } from '@dereekb/dbx-cli';
import type { ScoredArchetype } from './score.js';
import type { ResolvedAxes, ResolvedAxisAlternatives } from './axes.js';

/**
 * Optional knobs for {@link formatArchetypeEntry}.
 */
export interface FormatArchetypeEntryOptions {
  readonly axes?: ResolvedAxes;
  readonly showFullAxes?: boolean;
}

/**
 * Renders a single archetype catalog entry as markdown — used by both the
 * recommender (for the matched archetype) and the lookup tool.
 *
 * @param archetype - The archetype catalog entry to render.
 * @param options - Optional axis values and section toggles.
 * @returns The markdown body.
 */
export function formatArchetypeEntry(archetype: ModelArchetypeInfo, options: FormatArchetypeEntryOptions = {}): string {
  const lines: string[] = [`# Archetype: \`${archetype.slug}\``, ''];
  lines.push(archetype.description, '', `- **Family:** \`${archetype.family}\``, `- **Implied collectionKind:** \`${archetype.collectionKind}\``);
  if (archetype.extensionCluster) {
    lines.push(`- **Extension cluster:** \`${archetype.extensionCluster}\``);
  }
  const axesNote = formatAxesLine(archetype, options.axes, options.showFullAxes ?? false);
  if (axesNote) lines.push(axesNote);
  if (archetype.disambiguation) {
    lines.push(`- **Disambiguation:** ${archetype.disambiguation}`);
  }
  lines.push('', `## When to use`, '', archetype.whenToUse, '');
  if (options.showFullAxes && Object.keys(archetype.axes).length > 0) {
    lines.push('## Axes', '');
    for (const [axisName, values] of Object.entries(archetype.axes)) {
      const valueParts = values.map(wrapBacktick).join(' | ');
      lines.push(`- \`${axisName}\`: ${valueParts}`);
    }
    lines.push('');
  }
  if (archetype.implementationPointers.length > 0) {
    lines.push('## Implementation pointers', '');
    for (const pointer of archetype.implementationPointers) {
      lines.push(`- ${pointer}`);
    }
  }
  return lines.join('\n').trimEnd();
}

function wrapBacktick(value: string): string {
  return '`' + value + '`';
}

function formatAxesLine(archetype: ModelArchetypeInfo, resolved: ResolvedAxes | undefined, showFullAxes: boolean): string | undefined {
  let result: string | undefined;
  const archetypeAxisNames = Object.keys(archetype.axes);
  if (archetypeAxisNames.length === 0) {
    result = undefined;
  } else if (resolved && Object.keys(resolved).length > 0) {
    const parts = Object.entries(resolved).map(([k, v]) => `${k}=${wrapBacktick(v)}`);
    result = `- **Axes:** ${parts.join(', ')}`;
  } else if (!showFullAxes) {
    const parts = archetypeAxisNames.map((k) => `${k}=?`);
    result = `- **Axes (unresolved):** ${parts.join(', ')}`;
  }
  return result;
}

/**
 * Render input for {@link formatRecommendation}.
 *
 * `axisAlternatives` carries axis values the questionnaire could *also*
 * legitimately resolve to — e.g. `denormalised-aggregate` under a user-keyed
 * sub can key either `bucket-code` or `composite-flat-key`. When present,
 * the formatter renders both in the Shape block instead of silently picking
 * the value already in `axes`.
 */
export interface FormatRecommendationInput {
  readonly top: ScoredArchetype;
  readonly tied: readonly ScoredArchetype[];
  readonly axes: ResolvedAxes;
  readonly axisAlternatives?: ResolvedAxisAlternatives;
  readonly addons: readonly string[];
  readonly peers: readonly FirebaseModel[];
  readonly alternatives: readonly ScoredArchetype[];
  readonly scopeLabel: string;
  readonly shortCircuited: boolean;
}

/**
 * Renders the recommender's full markdown output. Mirrors the shape described
 * in `§5.1` of the planning doc.
 *
 * @param input - The structured recommendation payload.
 * @returns The markdown body.
 */
export function formatRecommendation(input: FormatRecommendationInput): string {
  const lines: string[] = [...formatRecommendationHeader(input), ...formatRecommendationWhy(input.top), ...formatRecommendationShape(input), ...formatRecommendationPeers(input), ...formatRecommendationPointers(input.top.archetype), ...formatRecommendationAlternatives(input.alternatives)];
  return lines.join('\n').trimEnd();
}

function formatRecommendationHeader(input: FormatRecommendationInput): readonly string[] {
  const { top, tied, axes, shortCircuited } = input;
  const lines: string[] = [];
  const slugLine = '# Recommended Archetype: ' + wrapBacktick(top.archetype.slug);
  lines.push(slugLine);

  const axesTitleParts: string[] = [];
  for (const [k, v] of Object.entries(axes)) {
    axesTitleParts.push(`${k}=${wrapBacktick(v)}`);
  }
  if (axesTitleParts.length > 0) {
    lines.push(`# Axes: ${axesTitleParts.join('  ')}`);
  }
  lines.push('');

  const confidencePct = `${Math.round(top.confidence * 100)}%`;
  const shortNote = shortCircuited ? ' (framework / singleton short-circuit)' : '';
  const matched = top.matches
    .slice(0, 6)
    .map((m) => m.dimension)
    .join(', ');
  const matchedDisplay = matched || '—';
  lines.push(`**Confidence:** ${top.confidence.toFixed(2)} (${confidencePct})${shortNote} (matched on ${matchedDisplay})`);

  if (tied.length > 0) {
    const tiedNames = tied.map((s) => wrapBacktick(s.archetype.slug)).join(', ');
    lines.push('', `> **Tied with** ${tiedNames} (within 0.10 confidence). Disambiguate using the questions below.`);
  }
  return lines;
}

function formatRecommendationWhy(top: ScoredArchetype): readonly string[] {
  const lines: string[] = ['', '## Why', ''];
  if (top.matches.length === 0 && top.mismatches.length === 0) {
    lines.push('- No dimensions in the questionnaire were filled in. Returning the lowest-cost archetype.');
    return lines;
  }
  for (const m of top.matches.slice(0, 8)) {
    lines.push(`- ${m.note}`);
  }
  if (top.mismatches.length > 0) {
    lines.push('', 'Mismatches:');
    for (const m of top.mismatches.slice(0, 4)) {
      lines.push(`- ${m.note}`);
    }
  }
  return lines;
}

function formatRecommendationShape(input: FormatRecommendationInput): readonly string[] {
  const { top, axes, axisAlternatives, addons } = input;
  const archetype = top.archetype;
  const lines: string[] = ['', '## Shape', ''];

  appendParentLine(lines, archetype.expected.parentRelation);
  lines.push(`- **collectionKind:** ${wrapBacktick(archetype.collectionKind)}`);
  appendExpectedList(lines, 'Doc ID source', archetype.expected.docIdSource);
  appendExpectedList(lines, 'Sync mode', archetype.expected.syncMode);

  const alternatives = axisAlternatives ?? {};
  appendAxisLines(lines, axes, alternatives);
  appendUnpairedAlternatives(lines, axes, alternatives);

  if (addons.length > 0) {
    const addonsList = addons.map(wrapBacktick).join(', ');
    lines.push(`- **Field-level add-ons:** ${addonsList}`);
  }
  if (archetype.extensionCluster) {
    lines.push(`- **Extension cluster:** ${wrapBacktick(archetype.extensionCluster)}`);
  }
  return lines;
}

function appendParentLine(lines: string[], parentRelation: readonly string[] | undefined): void {
  if (parentRelation && parentRelation.length > 0) {
    const parents = parentRelation.map(wrapBacktick).join(' / ');
    lines.push(`- **Parent:** ${parents}`);
  } else {
    lines.push('- **Parent:** —');
  }
}

function appendExpectedList(lines: string[], label: string, values: readonly string[] | undefined): void {
  if (values === undefined || values.length === 0) return;
  const formatted = values.map(wrapBacktick).join(' / ');
  lines.push(`- **${label}:** ${formatted}`);
}

function appendAxisLines(lines: string[], axes: ResolvedAxes, alternatives: ResolvedAxisAlternatives): void {
  for (const [k, v] of Object.entries(axes)) {
    const altList = alternatives[k];
    if (altList && altList.length > 0) {
      const allValues = [v, ...altList].map(wrapBacktick).join(' OR ');
      lines.push(`- **${k}:** ${allValues}  _(ambiguous — flag the choice in the design doc)_`);
    } else {
      lines.push(`- **${k}:** ${wrapBacktick(v)}`);
    }
  }
}

function appendUnpairedAlternatives(lines: string[], axes: ResolvedAxes, alternatives: ResolvedAxisAlternatives): void {
  for (const [k, alts] of Object.entries(alternatives)) {
    if (axes[k] === undefined && alts.length > 0) {
      const allValues = alts.map(wrapBacktick).join(' OR ');
      lines.push(`- **${k}:** ${allValues}  _(ambiguous — flag the choice in the design doc)_`);
    }
  }
}

function formatRecommendationPeers(input: FormatRecommendationInput): readonly string[] {
  const { peers, top, scopeLabel } = input;
  const slug = top.archetype.slug;
  const lines: string[] = ['', `## Peer models (${scopeLabel})`, ''];
  if (peers.length === 0) {
    lines.push(`_No peer models tagged ${wrapBacktick(slug)} in scope._`);
    return lines;
  }
  lines.push('| Model | Prefix | modelType | Notes |', '|---|---|---|---|');
  for (const peer of peers) {
    const axesParts: string[] = [];
    const slugAxes = peer.archetypeAxesBySlug?.[slug];
    if (slugAxes) {
      for (const [k, v] of Object.entries(slugAxes)) {
        axesParts.push(`${k}=${v}`);
      }
    }
    const notes = axesParts.length > 0 ? axesParts.join(', ') : (peer.description ?? '—');
    lines.push(`| ${wrapBacktick(peer.name)} | ${wrapBacktick(peer.collectionPrefix)} | ${wrapBacktick(peer.modelType)} | ${escapePipes(notes)} |`);
  }
  return lines;
}

function formatRecommendationPointers(archetype: ModelArchetypeInfo): readonly string[] {
  const lines: string[] = ['', '## Implementation pointers', ''];
  for (const pointer of archetype.implementationPointers) {
    lines.push(`- ${pointer}`);
  }
  return lines;
}

function formatRecommendationAlternatives(alternatives: readonly ScoredArchetype[]): readonly string[] {
  if (alternatives.length === 0) {
    return [];
  }
  const lines: string[] = ['', '## Alternatives considered', ''];
  lines.push('| Archetype | Score | Confidence | Why not |', '|---|---|---|---|');
  for (const alt of alternatives) {
    const why = alt.mismatches[0]?.note ?? '—';
    lines.push(`| ${wrapBacktick(alt.archetype.slug)} | ${alt.score} | ${alt.confidence.toFixed(2)} | ${escapePipes(why)} |`);
  }
  return lines;
}

function escapePipes(s: string): string {
  return s.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

/**
 * Renders the archetype catalog as a grouped markdown list. Used by the
 * lookup tool when called with `topic="list"`.
 *
 * @param archetypes - The catalog entries to list.
 * @returns The markdown body.
 */
export function formatArchetypeCatalog(archetypes: readonly ModelArchetypeInfo[]): string {
  const byFamily = new Map<string, ModelArchetypeInfo[]>();
  for (const a of archetypes) {
    const bucket = byFamily.get(a.family);
    if (bucket) {
      bucket.push(a);
    } else {
      byFamily.set(a.family, [a]);
    }
  }
  const lines: string[] = ['# Model archetypes', '', `${archetypes.length} entries grouped by family.`, ''];
  for (const [family, entries] of byFamily) {
    lines.push(`## ${family} (${entries.length})`, '');
    for (const a of entries) {
      const axisKeys = Object.keys(a.axes);
      const axes = axisKeys.length > 0 ? ` _(axes: ${axisKeys.join(', ')})_` : '';
      lines.push(`- ${wrapBacktick(a.slug)} — ${a.description}${axes}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
