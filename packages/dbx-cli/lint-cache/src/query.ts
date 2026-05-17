import { existsSync, readFileSync } from 'node:fs';

import type { LintCache, LintCacheMessage } from './types';

export interface QueryFilters {
  readonly rule: readonly string[] | undefined;
  readonly severity: 'error' | 'warning' | undefined;
  readonly file: string | undefined;
  readonly message: string | undefined;
  readonly limit: number | undefined;
}

export interface QueryResult {
  readonly cache: LintCache;
  readonly matched: readonly LintCacheMessage[];
  readonly totalMatched: number;
  readonly truncated: boolean;
}

/**
 * Loads a cache file and returns the messages that satisfy every active
 * filter. `rule` is an OR across the listed rule IDs; the other filters are
 * AND-ed together. `limit` only changes the returned slice — `totalMatched`
 * is always the pre-limit count.
 */
export function runQuery(cachePath: string, filters: QueryFilters): QueryResult {
  if (!existsSync(cachePath)) {
    throw new Error(`lint cache not found: ${cachePath} — run \`build\` first`);
  }
  const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as LintCache;

  const ruleSet = filters.rule && filters.rule.length > 0 ? new Set(filters.rule) : null;
  const fileNeedle = filters.file && filters.file.length > 0 ? filters.file : null;
  const fileMatcher = fileNeedle && isGlobPattern(fileNeedle) ? globToRegExp(fileNeedle) : null;
  const messageNeedle = filters.message && filters.message.length > 0 ? filters.message.toLowerCase() : null;
  const severity = filters.severity;

  const matched: LintCacheMessage[] = [];
  for (const m of cache.messages) {
    if (ruleSet && (m.ruleId == null || !ruleSet.has(m.ruleId))) continue;
    if (severity && m.severity !== severity) continue;
    if (fileNeedle) {
      if (fileMatcher) {
        if (!fileMatcher.test(m.filePath)) continue;
      } else if (!m.filePath.includes(fileNeedle)) {
        continue;
      }
    }
    if (messageNeedle && !m.message.toLowerCase().includes(messageNeedle)) continue;
    matched.push(m);
  }

  const totalMatched = matched.length;
  const truncated = filters.limit != null && totalMatched > filters.limit;
  const limited = filters.limit != null ? matched.slice(0, filters.limit) : matched;

  return { cache, matched: limited, totalMatched, truncated };
}

function isGlobPattern(s: string): boolean {
  return s.includes('*') || s.includes('?');
}

function globToRegExp(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i] as string;
    if (ch === '*' && pattern[i + 1] === '*') {
      regex += '.*';
      i += 2;
      if (pattern[i] === '/') i += 1;
    } else if (ch === '*') {
      regex += '[^/]*';
      i += 1;
    } else if (ch === '?') {
      regex += '[^/]';
      i += 1;
    } else if ('.+^$()|[]{}\\/'.includes(ch)) {
      regex += `\\${ch}`;
      i += 1;
    } else {
      regex += ch;
      i += 1;
    }
  }
  return new RegExp(`^${regex}$`);
}
