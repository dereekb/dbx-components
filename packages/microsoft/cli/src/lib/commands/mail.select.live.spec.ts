import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Live check of the mail selection commands (`mail tag` / `mail untag`, filter `mail delete` / `mail move`,
 * `mail undo`) against Microsoft Graph, on THREE SELF-CREATED DRAFTS ONLY (no recipients, so they cannot be sent),
 * isolated by a unique category. It never touches real mail.
 *
 * Skipped unless `MSGRAPH_CLI_LIVE_TOKEN_SOURCE` names a saved msgraph-cli token source with Read + Write
 * (`Mail.ReadWrite`). `MSGRAPH_CLI_LIVE_MAILBOX` optionally targets a shared mailbox the token can write (still
 * drafts only); unset uses the token's own mailbox. Runs the BUILT CLI (`dist/packages/microsoft/cli/index.js`,
 * build `microsoft` first). The drafts are purged at the end (`--hard`).
 */
const TOKEN_SOURCE = process.env['MSGRAPH_CLI_LIVE_TOKEN_SOURCE'];
const MAILBOX = process.env['MSGRAPH_CLI_LIVE_MAILBOX'];
const WORKSPACE_ROOT = join(__dirname, '../../../../../..');
const CLI_PATH = join(WORKSPACE_ROOT, 'dist/packages/microsoft/cli/index.js');

interface Envelope<T> {
  readonly ok: boolean;
  readonly data: T;
  readonly code?: string;
  readonly error?: string;
}

function cli<T = any>(...args: string[]): Envelope<T> {
  const mailbox = MAILBOX && args[0] === 'mail' ? ['--mailbox', MAILBOX] : [];
  let raw: string;

  try {
    raw = execFileSync('node', [CLI_PATH, ...args, ...mailbox, '--token-source', TOKEN_SOURCE as string], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // a failed command prints its JSON envelope on stderr
    const failed = e as { stdout?: string; stderr?: string };
    raw = `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }

  return JSON.parse(raw.slice(raw.search(/[{[]/)));
}

function listIds(...args: string[]): string[] {
  const listed = cli('mail', 'list', ...args, '--all-pages', '--top', '100', '--pick', 'id');
  expect(listed.ok).toBe(true);
  const items: { id: string }[] = Array.isArray(listed.data) ? listed.data : (listed.data.value ?? []);
  return items.map((x) => x.id);
}

describe.skipIf(!TOKEN_SOURCE)('mail selection (live, self-created drafts only)', () => {
  it('tags, deletes by category within a cap, undoes, moves, untags, and cleans up', () => {
    expect(existsSync(CLI_PATH)).toBe(true);
    const ts = Date.now();
    const subject = `msgraph-cli-live-${ts}`;
    const category = `msgraph-cli-live-${ts}`;
    const ids: string[] = [];

    try {
      for (let i = 0; i < 3; i += 1) {
        const draft = cli<{ id: string }>('mail', 'draft', 'create', '--subject', subject, '--body', 'x');
        expect(draft.ok).toBe(true);
        ids.push(draft.data.id);
      }

      // tag by ids, then again: everything already tagged
      expect(cli('mail', 'tag', ...ids, '--category', category).data).toMatchObject({ total: 3, ok: 3 });
      expect(cli('mail', 'tag', ...ids, '--category', category).data).toMatchObject({ total: 0, alreadyTagged: 3 });

      // categories/any together with $orderby (the Phase 1 contingency)
      expect(listIds('--folder', 'drafts', '--category', category).sort()).toEqual([...ids].sort());

      const dryRun = cli('mail', 'delete', '--folder', 'drafts', '--category', category, '--dry-run');
      expect(dryRun.data).toMatchObject({ dryRun: true, matched: 3, toAct: 3 });

      const first = cli('mail', 'delete', '--folder', 'drafts', '--category', category, '--max-messages', '2', '--yes');
      expect(first.data).toMatchObject({ total: 2, ok: 2, matched: 3, complete: false, stopped: 'max-messages', remaining: 1 });
      const journal = first.data.undo.file as string;
      expect(journal).toBeTruthy();

      expect(cli('mail', 'delete', '--folder', 'drafts', '--category', category, '--yes').data).toMatchObject({ total: 1, ok: 1, complete: true });

      expect(cli('mail', 'undo', journal).data).toMatchObject({ total: 2, ok: 2, remaining: 0, complete: true });
      expect(listIds('--folder', 'drafts', '--category', category)).toHaveLength(2);
      expect(cli('mail', 'undo', journal).data).toMatchObject({ alreadyUndone: true });

      // the move path: archive when the mailbox has one, else Deleted Items (the pre-flight refuses before acting)
      let moved = cli('mail', 'move', '--folder', 'drafts', '--category', category, '--to', 'archive');

      if (!moved.ok && moved.code === 'NOT_FOUND') {
        moved = cli('mail', 'move', '--folder', 'drafts', '--category', category, '--to', 'deleteditems');
      }

      expect(moved.data).toMatchObject({ total: 2, ok: 2, complete: true });
      expect(moved.data.undo.file).toBeTruthy();

      // search selection: the index may lag, so 0–3 hits are fine
      const search = cli('mail', 'delete', '--folder', 'drafts', '--search', subject, '--dry-run');
      expect(search.ok).toBe(true);
      expect(search.data.matched).toBeLessThanOrEqual(3);

      const refused = cli('mail', 'delete', '--folder', 'deleteditems', '--category', category, '--yes');
      expect(refused.ok).toBe(false);
      expect(refused.code).toBe('INVALID_ARGUMENT');

      // untag every folder: nothing carries the category afterwards
      expect(cli('mail', 'untag', '--category', category).data).toMatchObject({ total: 3, ok: 3 });
      expect(listIds('--category', category)).toHaveLength(0);
    } finally {
      if (ids.length > 0) {
        // purge the drafts wherever they ended up; 404s are fine
        cli('mail', 'delete', ...ids, '--hard', '--yes');
      }
    }
  }, 120000);
});
