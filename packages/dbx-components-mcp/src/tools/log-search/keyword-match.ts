/**
 * Case-insensitive substring scanner for the `keyword` mode of
 * `dbx_log_search`. Returns the first matched line ±2 lines of surrounding
 * context, intentionally distinct from the tokenized fuzzy path.
 */

import type { ParsedLog } from './types.js';

const CONTEXT_LINES = 2;
const MAX_SNIPPET_LENGTH = 600;

/**
 * Single keyword-mode hit: the log entry plus the line range that matched and
 * the rendered snippet around it.
 */
export interface KeywordHit {
  readonly entry: ParsedLog;
  readonly matchedLineIndex: number;
  readonly snippet: string;
}

/**
 * Returns all logs in which `query` appears as a case-insensitive substring,
 * each with a small snippet around the first match. The result preserves input
 * order so callers (which typically sort by recency) keep their ordering.
 */
export function keywordMatchLogs(logs: readonly ParsedLog[], query: string): readonly KeywordHit[] {
  const needle = query.toLowerCase();
  const hits: KeywordHit[] = [];
  if (needle.length > 0) {
    for (const log of logs) {
      const hit = firstMatch(log, needle);
      if (hit !== undefined) {
        hits.push(hit);
      }
    }
  }
  return hits;
}

function firstMatch(log: ParsedLog, needle: string): KeywordHit | undefined {
  const lines = log.rawText.split(/\r?\n/);
  let result: KeywordHit | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].toLowerCase().includes(needle)) {
      const start = Math.max(0, i - CONTEXT_LINES);
      const end = Math.min(lines.length, i + CONTEXT_LINES + 1);
      const raw = lines.slice(start, end).join('\n');
      const snippet = raw.length > MAX_SNIPPET_LENGTH ? `${raw.slice(0, MAX_SNIPPET_LENGTH)}…` : raw;
      result = { entry: log, matchedLineIndex: i, snippet };
      break;
    }
  }
  return result;
}
