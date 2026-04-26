/**
 * Markdown formatters for `dbx_semantic_type_lookup` /
 * `dbx_semantic_type_search` results.
 *
 * Two depths drive the lookup output:
 *
 *   - `brief` — name, package, module, definition, baseType, topics. One
 *     compact section that callers can render inline or aggregate over a
 *     collision group.
 *   - `full` — brief plus examples, guards, factories, related, notes,
 *     deprecated, since, sourceLocation. Emits a section per available
 *     field so callers can see everything the manifest carries.
 *
 * Search results always render in brief form, sorted alphabetically by
 * name (the registry already sorts; the formatter just keeps order).
 */

import type { SemanticTypeEntry } from '../manifest/semantic-types-schema.js';

// MARK: Single-entry rendering
/**
 * Renders one semantic-type entry at the requested depth.
 *
 * @param entry - the entry to render
 * @param depth - `'brief'` for a compact section, `'full'` for the long form
 * @returns markdown text starting with a level-2 heading
 */
export function formatSemanticTypeEntry(entry: SemanticTypeEntry, depth: 'brief' | 'full'): string {
  let result: string;
  if (depth === 'brief') {
    result = formatBrief(entry);
  } else {
    result = formatFull(entry);
  }
  return result;
}

// MARK: Brief
function formatBrief(entry: SemanticTypeEntry): string {
  const lines: string[] = [];
  lines.push(`## \`${entry.name}\``);
  lines.push('');
  lines.push(`- **package:** \`${entry.package}\``);
  lines.push(`- **module:** \`${entry.module}\``);
  lines.push(`- **kind:** ${entry.kind}`);
  lines.push(`- **baseType:** ${entry.baseType}`);
  lines.push(`- **topics:** ${formatTopicList(entry.topics)}`);
  lines.push('');
  lines.push('```ts');
  lines.push(entry.definition);
  lines.push('```');
  return lines.join('\n');
}

function formatTopicList(topics: readonly string[]): string {
  let result: string;
  if (topics.length === 0) {
    result = '_(none)_';
  } else {
    result = topics.map((t) => `\`${t}\``).join(', ');
  }
  return result;
}

// MARK: Full
function formatFull(entry: SemanticTypeEntry): string {
  const sections: string[] = [formatBrief(entry)];
  if (entry.deprecated !== undefined) {
    sections.push(formatDeprecated(entry.deprecated));
  }
  if (entry.since !== undefined) {
    sections.push(`### Since\n\n${entry.since}`);
  }
  const guards = entry.guards ?? [];
  if (guards.length > 0) {
    sections.push(`### Guards\n\n${formatBacktickList(guards)}`);
  }
  const factories = entry.factories ?? [];
  if (factories.length > 0) {
    sections.push(`### Factories\n\n${formatBacktickList(factories)}`);
  }
  const converters = entry.converters ?? [];
  if (converters.length > 0) {
    sections.push(`### Converters\n\n${formatBacktickList(converters)}`);
  }
  const aliases = entry.aliases ?? [];
  if (aliases.length > 0) {
    sections.push(`### Aliases\n\n${formatBacktickList(aliases)}`);
  }
  const related = entry.related ?? [];
  if (related.length > 0) {
    sections.push(`### Related\n\n${formatBacktickList(related)}`);
  }
  const reExports = entry.reExportedFrom ?? [];
  if (reExports.length > 0) {
    const reExportLines = reExports.map((r) => `- \`${r.package}\` · \`${r.module}\``).join('\n');
    sections.push(`### Re-exported from\n\n${reExportLines}`);
  }
  const examples = entry.examples ?? [];
  if (examples.length > 0) {
    sections.push(formatExamples(examples));
  }
  if (entry.notes !== undefined && entry.notes.length > 0) {
    sections.push(`### Notes\n\n${entry.notes}`);
  }
  if (entry.sourceLocation !== undefined) {
    sections.push(`### Source\n\n\`${entry.sourceLocation.file}:${entry.sourceLocation.line}\``);
  }
  return sections.join('\n\n');
}

function formatDeprecated(value: boolean | string): string {
  let result: string;
  if (typeof value === 'string') {
    result = `### Deprecated\n\n${value}`;
  } else if (value) {
    result = '### Deprecated\n\nThis semantic type is deprecated.';
  } else {
    result = '';
  }
  return result;
}

function formatBacktickList(values: readonly string[]): string {
  return values.map((v) => `- \`${v}\``).join('\n');
}

function formatExamples(examples: readonly { readonly caption?: string; readonly code: string }[]): string {
  const lines: string[] = ['### Examples'];
  for (const example of examples) {
    lines.push('');
    if (example.caption !== undefined && example.caption.length > 0) {
      lines.push(`_${example.caption}_`);
      lines.push('');
    }
    lines.push('```ts');
    lines.push(example.code);
    lines.push('```');
  }
  return lines.join('\n');
}

// MARK: Collision rendering
/**
 * Renders multiple entries that share the same name (cross-package collision).
 * Each entry renders in brief form and gets a callout banner so the caller
 * understands it has to disambiguate.
 *
 * @param name - the name that resolved to multiple entries
 * @param entries - the colliding entries (typically two; rarely more)
 * @returns markdown text combining every entry's brief shape
 */
export function formatSemanticTypeCollision(name: string, entries: readonly SemanticTypeEntry[]): string {
  const lines: string[] = [`# \`${name}\` — multiple matches`, '', `\`${name}\` is exported from ${entries.length} packages. Pass \`name\` plus the package via \`dbx_semantic_type_search\` if you need a single answer.`, ''];
  for (const entry of entries) {
    lines.push(formatBrief(entry));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Search rendering
/**
 * Renders a list of search results.
 *
 * @param config - the rendering inputs
 * @param config.query - the search descriptor for the heading (e.g. `topic:duration`)
 * @param config.entries - matched entries, already in display order
 * @returns markdown text starting with a top-level heading
 */
export function formatSemanticTypeSearchResults(config: { readonly query: string; readonly entries: readonly SemanticTypeEntry[] }): string {
  const { query, entries } = config;
  let text: string;
  if (entries.length === 0) {
    text = [`# Search: \`${query}\``, '', 'No semantic types matched the supplied filters.'].join('\n');
  } else {
    const lines: string[] = [`# Search: \`${query}\``, '', `${entries.length} result${entries.length === 1 ? '' : 's'}`, ''];
    for (const entry of entries) {
      lines.push(formatBrief(entry));
      lines.push('');
    }
    text = lines.join('\n').trimEnd();
  }
  return text;
}

// MARK: Catalog rendering
/**
 * Renders a catalog summary of the registry — total count plus distinct
 * topics, packages, baseTypes — for the not-found / "no filters" cases.
 *
 * @param config - the registry summary
 * @param config.total - total entry count
 * @param config.topics - distinct topics (sorted)
 * @param config.packages - distinct packages (sorted)
 * @param config.baseTypes - distinct baseTypes (sorted)
 * @param config.loadedSources - source labels that loaded successfully
 * @returns markdown text describing what the registry contains
 */
export function formatSemanticTypeCatalog(config: { readonly total: number; readonly topics: readonly string[]; readonly packages: readonly string[]; readonly baseTypes: readonly string[]; readonly loadedSources: readonly string[] }): string {
  const lines: string[] = ['# Semantic-types registry', ''];
  lines.push(`- **entries:** ${config.total}`);
  lines.push(`- **packages:** ${formatBacktickInline(config.packages)}`);
  lines.push(`- **sources:** ${formatBacktickInline(config.loadedSources)}`);
  lines.push(`- **topics:** ${formatBacktickInline(config.topics)}`);
  lines.push(`- **baseTypes:** ${formatBacktickInline(config.baseTypes)}`);
  return lines.join('\n');
}

function formatBacktickInline(values: readonly string[]): string {
  let result: string;
  if (values.length === 0) {
    result = '_(none)_';
  } else {
    result = values.map((v) => `\`${v}\``).join(', ');
  }
  return result;
}
