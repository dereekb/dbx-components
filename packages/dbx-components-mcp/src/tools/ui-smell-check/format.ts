/**
 * Markdown formatter for `dbx_ui_smell_check` output.
 *
 * Output sections (each emitted only when relevant):
 *   • `## Detected smells` — bullet per match.
 *   • `## Tokens to use` — table of hardcoded values flagged → recommended var.
 *   • `## No-match notes` — anything we noticed but couldn't confidently fix.
 */

import type { TokenRegistry } from '../../registry/tokens-runtime.js';
import type { SmellMatch } from './smells.js';

/**
 * Renders the detected smells as markdown. Walks the matches and collects
 * any recommended tokens into a single "Tokens to use" table.
 *
 * @param input - the original tool inputs (for echoing context)
 * @param input.html - the HTML snippet (may be empty)
 * @param input.scss - the SCSS snippet (may be empty)
 * @param input.context - optional caller-supplied context one-liner
 * @param matches - the detected smells in catalog order
 * @param tokenRegistry - the token registry used to resolve recommended vars
 * @returns the markdown body
 */
export function formatSmellResult(input: { readonly html: string; readonly scss: string; readonly context?: string }, matches: readonly SmellMatch[], tokenRegistry: TokenRegistry): string {
  const sections: string[] = [];
  const title = '# UI smell check';
  sections.push(title);

  if (input.context !== undefined && input.context.length > 0) {
    sections.push(`_Context:_ ${input.context}`);
  }

  if (matches.length === 0) {
    const goodSignals = formatGoodSignals(input.html, input.scss);
    if (goodSignals !== null) {
      sections.push('', 'No smells detected.', '', goodSignals, '', 'For a token recommendation, call `dbx_css_token_lookup` with an `intent` or `value`.');
    } else {
      sections.push('', 'No smells detected against the v1 catalog. If you still want a token recommendation, call `dbx_css_token_lookup` with an `intent` or `value`.');
    }
  } else {
    sections.push('', '## Detected smells', '');
    for (const match of matches) {
      sections.push(formatMatch(match));
    }
    const tokenTable = formatTokenTable(matches, tokenRegistry);
    if (tokenTable !== null) {
      sections.push('', '## Tokens to use', '', tokenTable);
    }
    const infoOnly = matches.filter((m) => m.severity === 'info');
    if (infoOnly.length > 0) {
      sections.push('', '## No-match notes', '');
      for (const match of infoOnly) {
        sections.push(`- **${match.id}** — ${match.title}`);
      }
    }
  }
  return sections.join('\n');
}

function formatMatch(match: SmellMatch): string {
  const lines: string[] = [`### ${match.id} · ${match.severity}`, '', match.title, '', '```', match.snippet, '```', '', match.fix];
  if (match.seeAlsoSlugs.length > 0 || match.seeAlsoTokens.length > 0) {
    const refs: string[] = [];
    for (const slug of match.seeAlsoSlugs) {
      refs.push(`\`dbx_ui_lookup topic="${slug}"\``);
    }
    for (const token of match.seeAlsoTokens) {
      refs.push(`\`dbx_css_token_lookup value="${token}"\``);
    }
    lines.push('', `See also: ${refs.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Builds the "Good signals" inventory shown in the no-smells branch.
 * Counts `dbx-*` element occurrences (deduped by tag) plus design-system
 * `var(--dbx-*)` / `var(--mat-sys-*)` references, so the caller can confirm
 * the scanner actually saw their content. Returns null when there's nothing
 * to report (both inputs empty).
 */
function formatGoodSignals(html: string, scss: string): string | null {
  let result: string | null = null;
  if (html.length > 0 || scss.length > 0) {
    const lines: string[] = [];
    if (html.length > 0) {
      const elements = new Map<string, number>();
      for (const match of html.matchAll(/<(dbx-[\w-]+)\b/g)) {
        const tag = match[1].toLowerCase();
        elements.set(tag, (elements.get(tag) ?? 0) + 1);
      }
      if (elements.size > 0) {
        const summary = Array.from(elements.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([tag, n]) => `${tag} ×${n}`)
          .join(', ');
        lines.push(`- HTML uses: ${summary}`);
      } else {
        lines.push('- HTML uses: no `dbx-*` elements');
      }
    }
    if (scss.length > 0) {
      let dbx = 0;
      let matSys = 0;
      for (const match of scss.matchAll(/var\(\s*(--[\w-]+)/g)) {
        const name = match[1];
        if (name.startsWith('--dbx-')) dbx += 1;
        else if (name.startsWith('--mat-sys-')) matSys += 1;
      }
      lines.push(`- SCSS uses: ${dbx} \`--dbx-*\` reference${dbx === 1 ? '' : 's'}, ${matSys} \`--mat-sys-*\` reference${matSys === 1 ? '' : 's'}`);
    }
    if (lines.length > 0) {
      result = `Good signals:\n${lines.join('\n')}`;
    }
  }
  return result;
}

function formatTokenTable(matches: readonly SmellMatch[], _tokenRegistry: TokenRegistry): string | null {
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    for (const token of match.seeAlsoTokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      rows.push(`| ${match.id} | \`var(${token})\` |`);
    }
  }
  let result: string | null;
  if (rows.length === 0) {
    result = null;
  } else {
    result = ['| Smell | Recommended var |', '| --- | --- |', ...rows].join('\n');
  }
  return result;
}
