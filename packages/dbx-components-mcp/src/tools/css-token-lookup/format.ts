/**
 * Markdown formatter for `dbx_css_token_lookup` output.
 *
 * Three modes:
 *   • single-confident match — one detailed entry block;
 *   • ambiguous (top 3) — disambiguating list;
 *   • browse / no-match — grouped table or "no confident match" notice.
 */

import type { TokenEntry } from '../../manifest/tokens-schema.js';
import type { ScoredTokenMatch, TokenRegistry } from '../../registry/tokens-runtime.js';
import type { ResolveTokenInput, ResolveTokenResult } from './resolve.js';

/**
 * Renders a {@link ResolveTokenResult} as the markdown body returned by the
 * tool.
 *
 * @param registry - the token registry (used for browse-mode catalog rendering)
 * @param input - the original tool query, used to title the output
 * @param result - the resolution outcome to render
 * @returns the markdown body
 */
export function formatCssTokenLookup(registry: TokenRegistry, input: ResolveTokenInput, result: ResolveTokenResult): string {
  let text: string;
  if ((input.category !== undefined && input.category !== 'list') || (input.intent === undefined && input.value === undefined && input.component === undefined && input.role === undefined)) {
    if (input.category !== undefined) {
      text = formatBrowse(registry, input.category, result.matches);
    } else if (input.role !== undefined) {
      text = formatBrowse(registry, undefined, result.matches);
    } else {
      text = formatNoQuery();
    }
  } else if (result.matches.length === 0) {
    text = formatNoMatch(input);
  } else if (!result.confident && result.matches.length > 1) {
    text = formatAmbiguous(input, result.matches);
  } else {
    text = formatSingle(result.matches[0], input, result.matches.slice(1));
  }
  return text;
}

function formatSingle(match: ScoredTokenMatch, input: ResolveTokenInput, otherMatches: readonly ScoredTokenMatch[]): string {
  const entry = match.entry;
  const lines: string[] = [`# \`${entry.cssVariable}\``, '', formatHeaderLine(entry), '', `**Use:** \`var(${entry.cssVariable})\``];
  if (entry.scssVariable !== undefined) {
    lines.push(`**SCSS:** \`${entry.scssVariable}\``);
  }
  lines.push('');
  lines.push(entry.description);

  if (entry.defaults.light !== undefined || entry.defaults.dark !== undefined) {
    lines.push('', '## Default value');
    if (entry.defaults.light !== undefined) {
      lines.push(`- light: \`${entry.defaults.light}\``);
    }
    if (entry.defaults.dark !== undefined) {
      lines.push(`- dark: \`${entry.defaults.dark}\``);
    }
  }

  if (entry.antiUseNotes !== undefined && entry.antiUseNotes.length > 0) {
    lines.push('', "## Don't use this when", '', entry.antiUseNotes);
  }

  if (entry.utilityClasses !== undefined && entry.utilityClasses.length > 0) {
    const classes = entry.utilityClasses.map((c) => `\`${c}\``).join(', ');
    lines.push('', `## Utility classes`, '', classes);
  }

  if (entry.recommendedPrimitive !== undefined) {
    lines.push('', '## Recommended primitive', '', `Reach for \`${entry.recommendedPrimitive}\` when you'd otherwise hand-roll this token. See \`dbx_ui_lookup topic="${entry.recommendedPrimitive}"\`.`);
  }

  if (entry.seeAlso !== undefined && entry.seeAlso.length > 0) {
    const seeAlso = entry.seeAlso.map((s) => `\`${s}\``).join(', ');
    lines.push('', '## See also', '', seeAlso);
  }

  if (otherMatches.length > 0) {
    lines.push('', '## Other candidates', '');
    for (const candidate of otherMatches) {
      lines.push(`- \`${candidate.entry.cssVariable}\` · ${candidate.entry.role} · score ${candidate.score}`);
    }
  }
  return lines.join('\n');
}

function formatHeaderLine(entry: TokenEntry): string {
  const parts: string[] = [`**source:** \`${entry.source}\``, `**role:** \`${entry.role}\``];
  if (entry.componentScope !== undefined) parts.push(`**component:** \`${entry.componentScope}\``);
  return parts.join(' · ');
}

function formatAmbiguous(input: ResolveTokenInput, matches: readonly ScoredTokenMatch[]): string {
  const lines: string[] = [`# Top candidates`, '', `Multiple tokens look relevant for the supplied query (${describeQuery(input)}). The candidates are sorted by confidence:`, ''];
  for (const match of matches) {
    lines.push(`## \`${match.entry.cssVariable}\` · score ${match.score}`);
    lines.push('', `${match.entry.description}`, '');
    if (match.entry.defaults.light !== undefined) {
      lines.push(`- light default: \`${match.entry.defaults.light}\``);
    }
    if (match.entry.defaults.dark !== undefined) {
      lines.push(`- dark default: \`${match.entry.defaults.dark}\``);
    }
    if (match.entry.antiUseNotes !== undefined && match.entry.antiUseNotes.length > 0) {
      lines.push('', match.entry.antiUseNotes);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function formatBrowse(registry: TokenRegistry, category: string | undefined, matches: readonly ScoredTokenMatch[]): string {
  const list = matches.length > 0 ? matches.map((m) => m.entry) : registry.all;
  const title = category !== undefined ? `# Tokens · category \`${category}\`` : `# Tokens`;
  const lines: string[] = [title, ''];
  if (list.length === 0) {
    lines.push('_No tokens matched._');
  } else {
    lines.push('| CSS variable | Role | Source | Description |');
    lines.push('| --- | --- | --- | --- |');
    for (const entry of list) {
      const desc = entry.description.replaceAll('|', String.raw`\|`).split('\n')[0];
      lines.push(`| \`${entry.cssVariable}\` | ${entry.role} | ${entry.source} | ${desc} |`);
    }
  }
  return lines.join('\n');
}

function formatNoQuery(): string {
  return ['# `dbx_css_token_lookup`', '', 'Provide at least one of `intent`, `value`, `role`, `component`, or `category` (use `category="list"` to browse the full catalog).'].join('\n');
}

function formatNoMatch(input: ResolveTokenInput): string {
  const lines = ['# No confident match', '', `No token confidently matched the query (${describeQuery(input)}).`, '', "If this looks like a project-specific brand chrome value, define a project-local SCSS variable in your app's `styles.scss` instead of reaching for a system token."];
  return lines.join('\n');
}

function describeQuery(input: ResolveTokenInput): string {
  const parts: string[] = [];
  if (input.intent !== undefined) parts.push(`intent="${input.intent}"`);
  if (input.value !== undefined) parts.push(`value="${input.value}"`);
  if (input.role !== undefined) parts.push(`role="${input.role}"`);
  if (input.component !== undefined) parts.push(`component="${input.component}"`);
  if (input.category !== undefined) parts.push(`category="${input.category}"`);
  return parts.join(', ') || '(none)';
}
