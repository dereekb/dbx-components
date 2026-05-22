/**
 * Field-weighted scorer for parsed change-log entries. Plugs into the shared
 * `_search` infrastructure so the tool gets tokenizing, sorting, and tie-breaks
 * for free.
 */

import { searchEntries, tokenize, type SearchHit } from '../_search/score.js';
import type { ParsedLog } from './types.js';

const WEIGHT_TITLE = 5;
const WEIGHT_COMMIT_SUBJECT = 4;
const WEIGHT_SUMMARY = 3;
const WEIGHT_FILENAME = 2;
const WEIGHT_BODY = 1;

/**
 * Scores a single log against one raw query token. Multiple matches across
 * fields stack additively, mirroring the weighting in {@link route-search}.
 */
function scoreLogToken(entry: ParsedLog, token: string): number {
  const needle = token.toLowerCase();
  let score = 0;
  if (entry.title.toLowerCase().includes(needle)) {
    score += WEIGHT_TITLE;
  }
  if (entry.commitSubject?.toLowerCase().includes(needle) === true) {
    score += WEIGHT_COMMIT_SUBJECT;
  }
  if (entry.summary?.toLowerCase().includes(needle) === true) {
    score += WEIGHT_SUMMARY;
  }
  if (entry.ref.fileName.toLowerCase().includes(needle)) {
    score += WEIGHT_FILENAME;
  }
  if (score === 0 && entry.rawText.toLowerCase().includes(needle)) {
    score += WEIGHT_BODY;
  }
  return score;
}

/**
 * Input for {@link rankLogs}.
 */
export interface RankLogsInput {
  readonly logs: readonly ParsedLog[];
  readonly query: string;
  readonly limit: number;
}

/**
 * Ranks parsed logs against a fuzzy query and slices to `limit`. Uses
 * `tokenMatchMode: 'any'` because logs are short and full-AND semantics drop
 * too many obvious hits.
 */
export function rankLogs(input: RankLogsInput): readonly SearchHit<ParsedLog>[] {
  const tokens = tokenize(input.query);
  const ranked = searchEntries<ParsedLog>({
    entries: input.logs,
    tokens,
    scoreFn: scoreLogToken,
    tieBreaker: (entry) => entry.ref.relativePath,
    mode: 'any'
  });
  return ranked.slice(0, input.limit);
}
