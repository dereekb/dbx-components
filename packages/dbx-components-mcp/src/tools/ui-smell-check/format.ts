/**
 * Markdown formatter for `dbx_ui_smell_check` output.
 *
 * Output sections (each emitted only when relevant):
 *   • Summary line — totals + cascade/ignore/dedup counters when nonzero.
 *   • `## Detected smells` — bullet per match, with `Lstart[-end]` location
 *     and a `Locations:` list when duplicates were consolidated.
 *   • `## Tokens to use` — table of smell → recommended var.
 *   • `## Informational notes` — list of info-severity findings.
 */

import type { TokenRegistry } from '../../registry/tokens-runtime.js';
import type { DetectSmellsResult, SmellMatch, SmellMatchWithExtras } from './smells.js';

/**
 * One file in a batch run. The header echoes the path so the agent can map
 * findings back to source.
 */
export interface SmellResultFile {
  readonly label: string;
  readonly htmlPath?: string;
  readonly scssPath?: string;
  readonly result: DetectSmellsResult;
  readonly inputs: { readonly html: string; readonly scss: string };
}

/**
 * Renders the detected smells as markdown. Walks the matches and collects
 * any recommended tokens into a single "Tokens to use" table.
 *
 * @param input - the original tool inputs (for echoing context)
 * @param input.html - the HTML snippet (may be empty)
 * @param input.scss - the SCSS snippet (may be empty)
 * @param input.context - optional caller-supplied context one-liner
 * @param matchesOrResult - either a flat list of matches (legacy) or the full {@link DetectSmellsResult}
 * @param tokenRegistry - the token registry used to resolve recommended vars
 * @returns the markdown body
 */
export function formatSmellResult(input: { readonly html: string; readonly scss: string; readonly context?: string }, matchesOrResult: readonly SmellMatch[] | DetectSmellsResult, tokenRegistry: TokenRegistry): string {
  const result: DetectSmellsResult = Array.isArray(matchesOrResult) ? { matches: matchesOrResult as readonly SmellMatch[], suppressedByCascade: 0, suppressedByDirective: 0, duplicatesMerged: 0 } : (matchesOrResult as DetectSmellsResult);
  const matches = result.matches;
  const sections: string[] = [];
  sections.push('# UI smell check');

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
    appendSummaryFooter(sections, result);
  } else {
    appendSummaryFooter(sections, result);
    sections.push('', '## Detected smells', '');
    for (const match of matches as readonly SmellMatchWithExtras[]) {
      sections.push(formatMatch(match));
    }
    const tokenTable = formatTokenTable(matches, tokenRegistry);
    if (tokenTable !== null) {
      sections.push('', '## Tokens to use', '', tokenTable);
    }
    const infoDigest = formatInfoDigest(matches as readonly SmellMatchWithExtras[]);
    if (infoDigest !== null) {
      sections.push('', '## Informational notes', '', infoDigest);
    }
  }
  return sections.join('\n');
}

/**
 * Renders a batch result for many files. Emits one section per file with the
 * path as the heading; suppresses files that produced zero findings unless
 * every file did, in which case a one-line "all clean" summary is emitted.
 *
 * @param files - per-file results to render
 * @param tokenRegistry - registry used by the per-file formatter
 * @returns the combined markdown body
 */
export function formatBatchSmellResult(files: readonly SmellResultFile[], tokenRegistry: TokenRegistry): string {
  const sections: string[] = ['# UI smell check (batch)'];
  const dirty = files.filter((f) => f.result.matches.length > 0);
  const clean = files.filter((f) => f.result.matches.length === 0);
  sections.push('', `Scanned **${files.length} file${files.length === 1 ? '' : 's'}** — ${dirty.length} with findings, ${clean.length} clean.`);

  for (const file of dirty) {
    sections.push('', `## ${file.label}`, '');
    if (file.htmlPath !== undefined) sections.push(`- htmlPath: \`${file.htmlPath}\``);
    if (file.scssPath !== undefined) sections.push(`- scssPath: \`${file.scssPath}\``);
    sections.push(
      '',
      formatSmellResult({ html: file.inputs.html, scss: file.inputs.scss }, file.result, tokenRegistry)
        .replace(/^# UI smell check\n?/, '')
        .trimStart()
    );
  }

  if (clean.length > 0) {
    sections.push('', '## Clean files', '');
    for (const file of clean) {
      sections.push(`- ${file.label}`);
    }
  }

  return sections.join('\n');
}

function appendSummaryFooter(sections: string[], result: DetectSmellsResult): void {
  const parts: string[] = [];
  if (result.suppressedByCascade > 0) parts.push(`${result.suppressedByCascade} suppressed by card-surface cascade`);
  if (result.suppressedByDirective > 0) parts.push(`${result.suppressedByDirective} suppressed by \`// dbx-smell-ignore\``);
  if (result.duplicatesMerged > 0) parts.push(`${result.duplicatesMerged} duplicate occurrence${result.duplicatesMerged === 1 ? '' : 's'} merged`);
  if (parts.length > 0) {
    sections.push('', `_Filtered: ${parts.join(', ')}._`);
  }
}

function formatLocation(match: SmellMatchWithExtras): string {
  let loc: string;
  if (match.endLine > match.line) {
    loc = `L${match.line}-${match.endLine}`;
  } else {
    loc = `L${match.line}`;
  }
  return loc;
}

function formatMatch(match: SmellMatchWithExtras): string {
  const lines: string[] = [`### ${match.id} · ${match.severity} · ${formatLocation(match)} · ${match.source}`, '', match.title, '', '```', match.snippet, '```', ''];
  if (match.extraLines !== undefined && match.extraLines.length > 0) {
    const all = [match.line, ...match.extraLines];
    const shown = all
      .slice(0, 6)
      .map((n) => `L${n}`)
      .join(', ');
    const overflow = all.length > 6 ? `, +${all.length - 6} more` : '';
    lines.push(`Locations (×${all.length}): ${shown}${overflow}`, '');
  }
  lines.push(match.fix);
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

/**
 * Builds a per-id digest of info-severity findings: count + line range. The
 * full detail for each finding already appears under `## Detected smells`,
 * so this section is intentionally compact.
 */
function formatInfoDigest(matches: readonly SmellMatchWithExtras[]): string | null {
  const byId = new Map<string, number[]>();
  for (const match of matches) {
    if (match.severity !== 'info') continue;
    const lines = byId.get(match.id) ?? [];
    lines.push(match.line);
    if (match.extraLines !== undefined) {
      for (const extra of match.extraLines) lines.push(extra);
    }
    byId.set(match.id, lines);
  }
  if (byId.size === 0) return null;
  const rows: string[] = ['Info-severity findings — flagged for review but no canonical dbx-web replacement exists yet (full detail is in **Detected smells** above).', ''];
  const sortedIds = Array.from(byId.keys()).sort((a, b) => a.localeCompare(b));
  for (const id of sortedIds) {
    const lines = (byId.get(id) ?? []).sort((a, b) => a - b);
    let range: string;
    if (lines.length === 1) {
      range = `L${lines[0]}`;
    } else if (lines[0] === lines.at(-1)) {
      range = `L${lines[0]}`;
    } else {
      range = `L${lines[0]}–L${lines.at(-1)}`;
    }
    rows.push(`- **${id}** ×${lines.length} · ${range}`);
  }
  return rows.join('\n');
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
