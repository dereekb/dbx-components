/**
 * Markdown formatters for forge registry entries. The `dbx_form_lookup` tool calls
 * these to produce human-readable output that LLMs can pass through verbatim.
 *
 * Two depths:
 *   - `brief` — 3–6 line summary (slug / factoryName / produces / one-liner / minimal example)
 *   - `full`  — complete documentation with config table and full example
 */

import { FORGE_TIER_ORDER, type ForgeFieldInfo } from '../registry/index.js';

type Depth = 'brief' | 'full';

/**
 * Formats a single forge entry as markdown at the requested depth.
 */
export function formatForgeFieldEntry(field: ForgeFieldInfo, depth: Depth): string {
  const result = depth === 'brief' ? formatBrief(field) : formatFull(field);
  return result;
}

function formatBrief(field: ForgeFieldInfo): string {
  const tierBits = formatTierBits(field);
  const array = field.arrayOutput === 'yes' ? ' (array)' : field.arrayOutput === 'optional' ? ' (single or array)' : '';
  const result = [`## ${field.factoryName}`, '', `**slug:** \`${field.slug}\` · **tier:** \`${field.tier}\` · **produces:** \`${field.produces}\`${array}${tierBits}`, '', field.description, '', '```ts', field.minimalExample, '```'].join('\n');
  return result;
}

function formatFull(field: ForgeFieldInfo): string {
  const header = formatHeader(field);
  const configTable = formatConfigTable(field);
  const exampleSection = formatExampleSection(field);
  const tierDetails = formatTierDetails(field);

  const sections: string[] = [header, field.description, tierDetails, configTable, exampleSection].filter((s) => s.length > 0);
  const result = sections.join('\n\n');
  return result;
}

function formatHeader(field: ForgeFieldInfo): string {
  const array = field.arrayOutput === 'yes' ? ' · array output' : field.arrayOutput === 'optional' ? ' · array optional' : '';
  const result = [`# ${field.factoryName}`, '', `- **slug:** \`${field.slug}\``, `- **tier:** \`${field.tier}\``, `- **produces:** \`${field.produces}\`${array}`, `- **source:** \`packages/dbx-form/src/lib/forge/${field.sourcePath}\``].join('\n');
  return result;
}

function formatTierBits(field: ForgeFieldInfo): string {
  let result = '';
  if (field.tier === 'field-factory') {
    result = ` · ngFormType: \`${field.ngFormType}\``;
  } else if (field.tier === 'composite-builder') {
    result = ` · suffix: \`${field.suffix}\``;
  } else if (field.tier === 'primitive') {
    result = ` · returns: \`${field.returns}\``;
  }
  return result;
}

function formatTierDetails(field: ForgeFieldInfo): string {
  const lines: string[] = [];
  if (field.tier === 'field-factory') {
    lines.push('## Factory');
    lines.push(`- **ng-forge type:** \`${field.ngFormType}\``);
    lines.push(`- **wrapper pattern:** \`${field.wrapperPattern}\``);
    lines.push(`- **config interface:** \`${field.configInterface}\``);
    if (field.generic) {
      lines.push(`- **generic:** \`${field.generic}\``);
    }
  } else if (field.tier === 'composite-builder') {
    lines.push('## Composite');
    lines.push(`- **suffix:** \`${field.suffix}\``);
    lines.push(`- **config interface:** \`${field.configInterface}\``);
    if (field.composesFromSlugs.length > 0) {
      const composed = field.composesFromSlugs.map((s) => `\`${s}\``).join(', ');
      lines.push(`- **composes from:** ${composed}`);
    }
  } else {
    lines.push('## Primitive');
    lines.push(`- **returns:** \`${field.returns}\``);
    if (field.configInterface) {
      lines.push(`- **config interface:** \`${field.configInterface}\``);
    }
  }
  const result = lines.join('\n');
  return result;
}

function formatConfigTable(field: ForgeFieldInfo): string {
  const keys = Object.keys(field.config);
  let result: string;
  if (keys.length === 0) {
    result = '## Config\n\nNo configuration beyond `key`, `label`, `required`, and the standard `props` overrides.';
  } else {
    const rows = keys.map((key) => {
      const prop = field.config[key];
      const required = prop.required ? '✓' : '';
      const defaultCell = prop.default !== undefined ? `\`${String(prop.default)}\`` : '';
      const desc = prop.description.replace(/\|/g, '\\|');
      return `| \`${prop.name}\` | \`${prop.type.replace(/\|/g, '\\|')}\` | ${required} | ${defaultCell} | ${desc} |`;
    });
    result = ['## Config', '', '| Property | Type | Required | Default | Description |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
  }
  return result;
}

function formatExampleSection(field: ForgeFieldInfo): string {
  const result = ['## Example', '', '```ts', field.example, '```', '', '### Minimal', '', '```ts', field.minimalExample, '```'].join('\n');
  return result;
}

/**
 * Formats a list of forge entries — used when a query (slug/alias that
 * matches a produces value, or `list` topic) returns multiple candidates.
 */
export function formatForgeFieldGroup(fields: readonly ForgeFieldInfo[], title: string): string {
  if (fields.length === 0) {
    const result = `_No forge entries matched._`;
    return result;
  }
  const byTier = new Map<string, ForgeFieldInfo[]>();
  for (const field of fields) {
    const list = byTier.get(field.tier) ?? [];
    list.push(field);
    byTier.set(field.tier, list);
  }

  const sections: string[] = [`# ${title}`, ''];
  for (const tier of FORGE_TIER_ORDER) {
    const list = byTier.get(tier);
    if (!list || list.length === 0) {
      continue;
    }
    sections.push(`## ${tier} (${list.length})`);
    sections.push('');
    for (const field of list) {
      const array = field.arrayOutput === 'yes' ? ' *(array)*' : field.arrayOutput === 'optional' ? ' *(single or array)*' : '';
      sections.push(`- **\`${field.slug}\`** → \`${field.factoryName}\` — produces \`${field.produces}\`${array}. ${field.description}`);
    }
    sections.push('');
  }
  const result = sections.join('\n').trimEnd();
  return result;
}
