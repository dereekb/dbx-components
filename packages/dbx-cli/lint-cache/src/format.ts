import type { LintCacheMessage } from './types';
import type { QueryResult } from './query';

export type OutputFormat = 'summary' | 'rules' | 'files' | 'messages' | 'json';

/**
 * Renders a `QueryResult` as text in the requested format.
 *
 * @param format - One of `summary`, `rules`, `files`, `messages`, or `json`.
 * @param result - The filtered query result to render.
 * @returns The rendered text (caller decides whether to console.log or write to a file).
 */
export function renderResult(format: OutputFormat, result: QueryResult): string {
  let output: string;
  switch (format) {
    case 'rules':
      output = renderRules(result);
      break;
    case 'files':
      output = renderFiles(result);
      break;
    case 'messages':
      output = renderMessages(result);
      break;
    case 'json':
      output = JSON.stringify(result.matched, null, 2);
      break;
    default:
      output = renderSummary(result);
  }
  return output;
}

function renderSummary(r: QueryResult): string {
  const c = r.cache;
  const lines: string[] = [];
  lines.push(`Project: ${c.project} (${c.projectRoot})`);
  lines.push(`Generated: ${c.generatedAt}`, `Totals: ${c.errorCount} errors · ${c.warningCount} warnings · ${c.filesWithIssues}/${c.fileCount} files with issues`);
  const truncatedSuffix = r.truncated ? ` (showing ${r.matched.length})` : '';
  lines.push(`Matched: ${r.totalMatched} messages${truncatedSuffix}`);

  if (r.matched.length > 0) {
    const ruleCounts = aggregateByRule(r.matched);
    const fileCounts = aggregateByFile(r.matched);

    lines.push('', 'Top rules:');
    for (const [rule, count] of topEntries(ruleCounts, 10)) {
      lines.push(`  ${pad(count, 5)}  ${rule}`);
    }
    lines.push('', 'Top files:');
    for (const [file, count] of topEntries(fileCounts, 10)) {
      lines.push(`  ${pad(count, 5)}  ${file}`);
    }
  }

  return lines.join('\n');
}

function renderRules(r: QueryResult): string {
  const map = new Map<string, { errors: number; warnings: number; files: Set<string> }>();
  for (const m of r.matched) {
    const rule = m.ruleId ?? '(no-rule)';
    let entry = map.get(rule);
    if (!entry) {
      entry = { errors: 0, warnings: 0, files: new Set() };
      map.set(rule, entry);
    }
    if (m.severity === 'error') entry.errors += 1;
    else entry.warnings += 1;
    entry.files.add(m.filePath);
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[1].errors + b[1].warnings - (a[1].errors + a[1].warnings));
  const lines: string[] = [`Rules (${sorted.length}):`];
  for (const [rule, v] of sorted) {
    lines.push(`  ${pad(v.errors + v.warnings, 5)}  ${rule}  (${v.errors} err / ${v.warnings} warn, ${v.files.size} files)`);
  }
  return lines.join('\n');
}

function renderFiles(r: QueryResult): string {
  const map = new Map<string, { errors: number; warnings: number }>();
  for (const m of r.matched) {
    let entry = map.get(m.filePath);
    if (!entry) {
      entry = { errors: 0, warnings: 0 };
      map.set(m.filePath, entry);
    }
    if (m.severity === 'error') entry.errors += 1;
    else entry.warnings += 1;
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[1].errors + b[1].warnings - (a[1].errors + a[1].warnings));
  const lines: string[] = [`Files (${sorted.length}):`];
  for (const [file, v] of sorted) {
    lines.push(`  ${pad(v.errors + v.warnings, 5)}  ${file}  (${v.errors} err / ${v.warnings} warn)`);
  }
  return lines.join('\n');
}

function renderMessages(r: QueryResult): string {
  const truncatedSuffix = r.truncated ? `, showing ${r.matched.length}` : '';
  const lines: string[] = [`Messages (${r.totalMatched}${truncatedSuffix}):`];
  for (const m of r.matched) {
    const sev = m.severity === 'error' ? 'ERR ' : 'WARN';
    lines.push(`  ${sev}  ${m.filePath}:${m.line}:${m.column}  [${m.ruleId ?? '(no-rule)'}]  ${m.message}`);
  }
  return lines.join('\n');
}

function aggregateByRule(messages: readonly LintCacheMessage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of messages) {
    const key = m.ruleId ?? '(no-rule)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function aggregateByFile(messages: readonly LintCacheMessage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of messages) {
    counts.set(m.filePath, (counts.get(m.filePath) ?? 0) + 1);
  }
  return counts;
}

function topEntries(counts: Map<string, number>, n: number): [string, number][] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

function pad(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}
