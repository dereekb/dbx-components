/**
 * Markdown formatters for the `dbx_model_archetype_*` tool cluster.
 *
 * The recommender's primary output renders the matched archetype with its
 * derived axes, the implied collection kind, the implementation pointers, a
 * peer-model table (queried from the registry), and an "Alternatives
 * considered" section. The lookup tool reuses {@link formatArchetypeEntry}.
 */

import type { FirebaseModel } from '../../registry/firebase-models.js';
import type { ModelArchetypeInfo } from '../../registry/archetypes.js';
import type { ScoredArchetype } from './score.js';
import type { ResolvedAxes } from './axes.js';

/**
 * Optional knobs for {@link formatArchetypeEntry}.
 */
export interface FormatArchetypeEntryOptions {
  readonly axes?: ResolvedAxes;
  readonly deprecatedAlias?: string;
  readonly showFullAxes?: boolean;
}

/**
 * Renders a single archetype catalog entry as markdown — used by both the
 * recommender (for the matched archetype) and the lookup tool.
 *
 * @param archetype - the archetype catalog entry to render
 * @param options - optional axis values, deprecated-alias note, and section toggles
 * @returns the markdown body
 */
export function formatArchetypeEntry(archetype: ModelArchetypeInfo, options: FormatArchetypeEntryOptions = {}): string {
  const lines: string[] = [`# Archetype: \`${archetype.slug}\``, ''];
  if (options.deprecatedAlias) {
    lines.push(`> Deprecated alias \`${options.deprecatedAlias}\` resolved to v3 slug \`${archetype.slug}\`.`, '');
  }
  lines.push(archetype.description, '');
  lines.push(`- **Family:** \`${archetype.family}\``);
  lines.push(`- **Implied collectionKind:** \`${archetype.collectionKind}\``);
  if (archetype.extensionCluster) {
    lines.push(`- **Extension cluster:** \`${archetype.extensionCluster}\``);
  }
  const axesNote = formatAxesLine(archetype, options.axes, options.showFullAxes ?? false);
  if (axesNote) lines.push(axesNote);
  if (archetype.aliases.length > 0) {
    lines.push(`- **Aliases (v1/v2):** ${archetype.aliases.map((a) => `\`${a}\``).join(', ')}`);
  }
  if (archetype.disambiguation) {
    lines.push(`- **Disambiguation:** ${archetype.disambiguation}`);
  }
  lines.push('', `## When to use`, '', archetype.whenToUse, '');
  if (options.showFullAxes && Object.keys(archetype.axes).length > 0) {
    lines.push('## Axes', '');
    for (const [axisName, values] of Object.entries(archetype.axes)) {
      lines.push(`- \`${axisName}\`: ${values.map((v) => `\`${v}\``).join(' | ')}`);
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

function formatAxesLine(archetype: ModelArchetypeInfo, resolved: ResolvedAxes | undefined, showFullAxes: boolean): string | undefined {
  let result: string | undefined;
  const archetypeAxisNames = Object.keys(archetype.axes);
  if (archetypeAxisNames.length === 0) {
    // No axes for this archetype.
    result = undefined;
  } else if (resolved && Object.keys(resolved).length > 0) {
    const parts = Object.entries(resolved).map(([k, v]) => `${k}=\`${v}\``);
    result = `- **Axes:** ${parts.join(', ')}`;
  } else if (!showFullAxes) {
    const parts = archetypeAxisNames.map((k) => `${k}=?`);
    result = `- **Axes (unresolved):** ${parts.join(', ')}`;
  }
  return result;
}

/**
 * Render input for {@link formatRecommendation}.
 */
export interface FormatRecommendationInput {
  readonly top: ScoredArchetype;
  readonly tied: readonly ScoredArchetype[];
  readonly axes: ResolvedAxes;
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
 * @param input - the structured recommendation payload
 * @returns the markdown body
 */
export function formatRecommendation(input: FormatRecommendationInput): string {
  const { top, tied, axes, addons, peers, alternatives, scopeLabel, shortCircuited } = input;
  const archetype = top.archetype;

  const axesTitleParts: string[] = [];
  for (const [k, v] of Object.entries(axes)) {
    axesTitleParts.push(`${k}=\`${v}\``);
  }
  const axesTitle = axesTitleParts.length > 0 ? `# Axes: ${axesTitleParts.join('  ')}` : undefined;

  const lines: string[] = [];
  lines.push(`# Recommended Archetype: \`${archetype.slug}\``);
  if (axesTitle) lines.push(axesTitle);
  lines.push('');
  const confidencePct = `${Math.round(top.confidence * 100)}%`;
  const shortNote = shortCircuited ? ' (framework / singleton short-circuit)' : '';
  const matched = top.matches
    .slice(0, 6)
    .map((m) => m.dimension)
    .join(', ');
  lines.push(`**Confidence:** ${top.confidence.toFixed(2)} (${confidencePct})${shortNote} (matched on ${matched || '—'})`);
  if (tied.length > 0) {
    const tiedNames = tied.map((s) => `\`${s.archetype.slug}\``).join(', ');
    lines.push('', `> **Tied with** ${tiedNames} (within 0.10 confidence). Disambiguate using the questions below.`);
  }
  lines.push('', '## Why', '');
  if (top.matches.length === 0 && top.mismatches.length === 0) {
    lines.push('- No dimensions in the questionnaire were filled in. Returning the lowest-cost archetype.');
  } else {
    for (const m of top.matches.slice(0, 8)) {
      lines.push(`- ${m.note}`);
    }
    if (top.mismatches.length > 0) {
      lines.push('');
      lines.push('Mismatches:');
      for (const m of top.mismatches.slice(0, 4)) {
        lines.push(`- ${m.note}`);
      }
    }
  }

  lines.push('', '## Shape', '');
  if (archetype.expected.parentRelation && archetype.expected.parentRelation.length > 0) {
    lines.push(`- **Parent:** ${archetype.expected.parentRelation.map((p) => `\`${p}\``).join(' / ')}`);
  } else {
    lines.push('- **Parent:** —');
  }
  lines.push(`- **collectionKind:** \`${archetype.collectionKind}\``);
  if (archetype.expected.docIdSource && archetype.expected.docIdSource.length > 0) {
    lines.push(`- **Doc ID source:** ${archetype.expected.docIdSource.map((s) => `\`${s}\``).join(' / ')}`);
  }
  if (archetype.expected.syncMode && archetype.expected.syncMode.length > 0) {
    lines.push(`- **Sync mode:** ${archetype.expected.syncMode.map((s) => `\`${s}\``).join(' / ')}`);
  }
  for (const [k, v] of Object.entries(axes)) {
    lines.push(`- **${k}:** \`${v}\``);
  }
  if (addons.length > 0) {
    lines.push(`- **Field-level add-ons:** ${addons.map((a) => `\`${a}\``).join(', ')}`);
  }
  if (archetype.extensionCluster) {
    lines.push(`- **Extension cluster:** \`${archetype.extensionCluster}\``);
  }

  lines.push('', `## Peer models (${scopeLabel})`, '');
  if (peers.length === 0) {
    lines.push(`_No peer models tagged \`${archetype.slug}\` in scope._`);
  } else {
    lines.push('| Model | Prefix | modelType | Notes |', '|---|---|---|---|');
    for (const peer of peers) {
      const axesParts: string[] = [];
      if (peer.archetypeAxes) {
        for (const [k, v] of Object.entries(peer.archetypeAxes)) {
          axesParts.push(`${k}=${v}`);
        }
      }
      const notes = axesParts.length > 0 ? axesParts.join(', ') : (peer.description ?? '—');
      lines.push(`| \`${peer.name}\` | \`${peer.collectionPrefix}\` | \`${peer.modelType}\` | ${escapePipes(notes)} |`);
    }
  }

  lines.push('', '## Implementation pointers', '');
  for (const pointer of archetype.implementationPointers) {
    lines.push(`- ${pointer}`);
  }

  if (alternatives.length > 0) {
    lines.push('', '## Alternatives considered', '');
    lines.push('| Archetype | Score | Confidence | Why not |', '|---|---|---|---|');
    for (const alt of alternatives) {
      const why = alt.mismatches[0]?.note ?? '—';
      lines.push(`| \`${alt.archetype.slug}\` | ${alt.score} | ${alt.confidence.toFixed(2)} | ${escapePipes(why)} |`);
    }
  }

  return lines.join('\n').trimEnd();
}

function escapePipes(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * Renders the archetype catalog as a grouped markdown list. Used by the
 * lookup tool when called with `topic="list"`.
 *
 * @param archetypes - the catalog entries to list
 * @returns the markdown body
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
      const axes = Object.keys(a.axes).length > 0 ? ` _(axes: ${Object.keys(a.axes).join(', ')})_` : '';
      lines.push(`- \`${a.slug}\` — ${a.description}${axes}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
