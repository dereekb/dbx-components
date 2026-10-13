/**
 * Drift guard for `UPSTREAM_NOTIFICATION_TASK_HANDLERS`. The validator mirrors the upstream `@dereekb/firebase` /
 * `@dereekb/firebase-server` aggregate, task-type and handler-factory names as strings, so a rename upstream would
 * silently turn `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED` off. These specs read the upstream sources, pin each row,
 * and fail when a new upstream aggregate or handler factory appears that the table doesn't know.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UPSTREAM_NOTIFICATION_TASK_HANDLER_FACTORIES, UPSTREAM_NOTIFICATION_TASK_HANDLERS } from './extract.upstream.js';

const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../../..');

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'dbx-cli', 'dbx-components-mcp', 'dbx-components-cli']);
const UPSTREAM_SEGMENTS = new Set(['firebase', 'firebase-server']);

const ADD_ROW_HINT = 'add a row to `UPSTREAM_NOTIFICATION_TASK_HANDLERS` (extract.upstream.ts) so `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED` checks it (an unknown upstream handler factory also makes the handlers trace opaque, which skips the check)';

interface UpstreamSource {
  readonly path: string;
  readonly text: string;
}

function walkTsFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        walkTsFiles(full, out);
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
}

function readUpstreamSources(): readonly UpstreamSource[] {
  const files: string[] = [];
  walkTsFiles(resolve(WORKSPACE_ROOT, 'packages'), files);
  return files
    .map((full) => relative(WORKSPACE_ROOT, full))
    .filter((path) => path.split(sep).some((segment) => UPSTREAM_SEGMENTS.has(segment)))
    .map((path) => ({ path, text: readFileSync(resolve(WORKSPACE_ROOT, path), 'utf8') }));
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function matchAll(sources: readonly UpstreamSource[], pattern: RegExp): string[] {
  return sources.flatMap((source) => [...source.text.matchAll(pattern)].map((match) => match[1]));
}

describe('upstream task handler drift guard', () => {
  const sources = readUpstreamSources();

  it.each(UPSTREAM_NOTIFICATION_TASK_HANDLERS)('upstream still declares the $label aggregate and task types', (row) => {
    const aggregate = new RegExp(String.raw`export const ${escapeRegExp(row.aggregate)}\s*:\s*NotificationTaskType\[\]\s*=\s*\[([^\]]*)\]`);
    const members = matchAll(sources, new RegExp(aggregate.source, 'g'));
    expect(members, `\`${row.aggregate}\` is mirrored by NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED (extract.upstream.ts) but no longer declared upstream. Update its row.`).toHaveLength(1);
    const memberNames = members[0]
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    expect(memberNames, `\`${row.aggregate}\` changed its task types upstream. Update the row's \`taskTypes\`.`).toEqual(row.taskTypes.map((x) => x.constant));
    for (const taskType of row.taskTypes) {
      const declared = new RegExp(String.raw`export const ${escapeRegExp(taskType.constant)}\s*:\s*NotificationTaskType\s*=\s*'${escapeRegExp(taskType.code)}'`);
      expect(
        sources.some((x) => declared.test(x.text)),
        `\`${taskType.constant} = '${taskType.code}'\` is mirrored by the row for \`${row.aggregate}\` but no longer declared upstream. Update its \`taskTypes\`.`
      ).toBe(true);
    }
  });

  it.each(UPSTREAM_NOTIFICATION_TASK_HANDLERS)('upstream $handlerFactory still handles the $label task types', (row) => {
    const declaration = new RegExp(String.raw`export function ${escapeRegExp(row.handlerFactory)}\b`);
    const source = sources.find((x) => declaration.test(x.text));
    expect(source, `\`${row.handlerFactory}\` is mirrored by NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED (extract.upstream.ts) but no longer declared upstream. Update its row.`).toBeDefined();
    const text = source?.text ?? '';
    const start = text.search(declaration);
    const next = text.indexOf('\nexport ', start + 1);
    const body = text.slice(start, next < 0 ? undefined : next);
    const passesTaskType = row.taskTypes.some((x) => new RegExp(String.raw`taskType:\s*${escapeRegExp(x.constant)}\b`).test(body));
    expect(passesTaskType, `\`${row.handlerFactory}\` no longer passes \`taskType: ${row.taskTypes.map((x) => x.constant).join(' | ')}\`. Update the row for \`${row.aggregate}\`.`).toBe(true);
  });

  it('the table covers every upstream task-type aggregate', () => {
    const found = [...new Set(matchAll(sources, /export const (ALL_\w+_NOTIFICATION_TASK_TYPES)\s*:\s*NotificationTaskType\[\]/g))].sort((a, b) => a.localeCompare(b));
    const expected = UPSTREAM_NOTIFICATION_TASK_HANDLERS.map((x) => x.aggregate).sort((a, b) => a.localeCompare(b));
    const unknown = found.filter((x) => !expected.includes(x));
    expect(found, `${unknown.map((x) => `\`${x}\``).join(', ')} is a new upstream task-type aggregate; ${ADD_ROW_HINT}.`).toEqual(expected);
  });

  it('the table covers every upstream handler factory', () => {
    const found = [...new Set(matchAll(sources, /export function (\w+)(?:<[^>]*>)?\([^)]*\)\s*:\s*NotificationTaskServiceTaskHandlerConfig</g))].sort((a, b) => a.localeCompare(b));
    const expected = [...UPSTREAM_NOTIFICATION_TASK_HANDLER_FACTORIES].sort((a, b) => a.localeCompare(b));
    const unknown = found.filter((x) => !expected.includes(x));
    expect(found, `${unknown.map((x) => `\`${x}\``).join(', ')} is a new upstream handler factory; ${ADD_ROW_HINT}.`).toEqual(expected);
  });
});
