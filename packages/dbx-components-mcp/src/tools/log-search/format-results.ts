/**
 * Markdown formatters for the three `dbx_log_search` modes. All formatters
 * return a single string so the dispatcher can wrap it in a `ToolResult`
 * without branching on mode.
 */

import type { SearchHit } from '../_search/score.js';
import type { KeywordHit } from './keyword-match.js';
import type { LogSearchMode, ParsedLog } from './types.js';

const MAX_LIST_SNIPPET_LENGTH = 240;
const MAX_FUZZY_SNIPPET_LENGTH = 320;

/**
 * Shared header information rendered above every result set.
 */
export interface FormatHeader {
  readonly mode: LogSearchMode;
  readonly query: string | undefined;
  readonly scope: string;
  readonly windowLabel: string;
  readonly totalCandidates: number;
}

/**
 * Renders the `list` mode output (no query, just recent entries).
 *
 * @param header - Shared metadata rendered above the result block.
 * @param logs - Parsed log entries already sliced to the requested limit.
 * @returns A markdown string ready to wrap in a `ToolResult` text part.
 */
export function formatListResults(header: FormatHeader, logs: readonly ParsedLog[]): string {
  const lines: string[] = [];
  lines.push(buildHeading(header), '');
  if (logs.length === 0) {
    lines.push('No change logs in window.');
  } else {
    lines.push(`${logs.length} log(s).`, '');
    for (const log of logs) {
      lines.push(...renderEntry(log, undefined, MAX_LIST_SNIPPET_LENGTH));
    }
  }
  return lines.join('\n').trimEnd();
}

/**
 * Renders the `fuzzy` mode output, annotating each entry with the matched
 * tokens so callers can see why a result ranked.
 *
 * @param header - Shared metadata rendered above the result block.
 * @param hits - Scored hits already sliced to the requested limit.
 * @returns A markdown string ready to wrap in a `ToolResult` text part.
 */
export function formatFuzzyResults(header: FormatHeader, hits: readonly SearchHit<ParsedLog>[]): string {
  const lines: string[] = [];
  lines.push(buildHeading(header), '');
  if (hits.length === 0) {
    lines.push(`No matches across ${header.totalCandidates} log(s) in window.`);
  } else {
    lines.push(`${hits.length} match(es) of ${header.totalCandidates} log(s) in window.`, '');
    for (const hit of hits) {
      const matchedSuffix = hit.matchedTokens.length > 0 ? ` _(matched: ${hit.matchedTokens.join(', ')})_` : '';
      lines.push(...renderEntry(hit.entry, matchedSuffix, MAX_FUZZY_SNIPPET_LENGTH));
    }
  }
  return lines.join('\n').trimEnd();
}

/**
 * Renders the `keyword` mode output, using the matched-line snippet rather
 * than the Summary section.
 *
 * @param header - Shared metadata rendered above the result block.
 * @param hits - Keyword-mode hits with the matched-line context snippet.
 * @returns A markdown string ready to wrap in a `ToolResult` text part.
 */
export function formatKeywordResults(header: FormatHeader, hits: readonly KeywordHit[]): string {
  const lines: string[] = [];
  lines.push(buildHeading(header), '');
  if (hits.length === 0) {
    lines.push(`No matches across ${header.totalCandidates} log(s) in window.`);
  } else {
    lines.push(`${hits.length} match(es) of ${header.totalCandidates} log(s) in window.`, '');
    for (const hit of hits) {
      const entry = hit.entry;
      lines.push(`### ${entry.title}`, `_${formatMeta(entry)}_`, '', '```', sanitizeFence(hit.snippet), '```', '');
    }
  }
  return lines.join('\n').trimEnd();
}

function buildHeading(header: FormatHeader): string {
  const queryPart = header.query !== undefined ? ` — \`${header.query}\`` : '';
  return `# Log search${queryPart} (mode: ${header.mode}, scope: ${header.scope}, window: ${header.windowLabel})`;
}

function renderEntry(entry: ParsedLog, matchedSuffix: string | undefined, maxSnippetLen: number): readonly string[] {
  const lines: string[] = [];
  const suffix = matchedSuffix ?? '';
  lines.push(`### ${entry.title}${suffix}`, `_${formatMeta(entry)}_`);
  const snippet = pickSnippet(entry, maxSnippetLen);
  if (snippet !== undefined) {
    lines.push('', ...snippet.split('\n').map((line) => `> ${line}`));
  }
  lines.push('');
  return lines;
}

function formatMeta(entry: ParsedLog): string {
  const dateLabel = entry.date ?? formatMtime(entry.ref.mtimeMs);
  return `${entry.ref.project} · ${dateLabel} · ${entry.ref.relativePath}`;
}

function formatMtime(mtimeMs: number): string {
  const date = new Date(mtimeMs);
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function pickSnippet(entry: ParsedLog, maxLen: number): string | undefined {
  let snippet: string | undefined;
  const candidate = entry.summary ?? entry.commitSubject;
  if (candidate !== undefined) {
    const trimmed = candidate.trim();
    snippet = trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
  }
  return snippet === undefined ? undefined : sanitizeFence(snippet);
}

function sanitizeFence(text: string): string {
  return text.replaceAll('```', '`​``');
}
