import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Live check of `files sheet` against Microsoft Graph, using the committed fixture workbook
 * (`src/test/msgraph-cli-sheet.fixture.xlsx`: sheet "People" = Name | State | Count | (blank) | Name with 2 rows;
 * sheet "Notes" = Note / hello world).
 *
 * Skipped unless `MSGRAPH_CLI_LIVE_TOKEN_SOURCE` names a saved msgraph-cli token source with Read + Write
 * (`Files.ReadWrite`). Runs the BUILT CLI (`dist/packages/microsoft/cli/index.js`, build `microsoft` first),
 * uploads the fixture into a scratch OneDrive folder, reads it back, and deletes the folder (recycle bin).
 */
const TOKEN_SOURCE = process.env['MSGRAPH_CLI_LIVE_TOKEN_SOURCE'];
const WORKSPACE_ROOT = join(__dirname, '../../../../../..');
const CLI_PATH = join(WORKSPACE_ROOT, 'dist/packages/microsoft/cli/index.js');
const FIXTURE_PATH = join(__dirname, '../../test/msgraph-cli-sheet.fixture.xlsx');

function cli<T = unknown>(...args: string[]): { readonly ok: boolean; readonly data: T; readonly code?: string; readonly suggestion?: string } {
  let raw: string;

  try {
    raw = execFileSync('node', [CLI_PATH, ...args, '--token-source', TOKEN_SOURCE as string], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // a failed command prints its JSON envelope on stderr
    const failed = e as { stdout?: string; stderr?: string };
    raw = `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }

  return JSON.parse(raw.slice(raw.search(/[{[]/)));
}

describe.skipIf(!TOKEN_SOURCE)('files sheet (live)', () => {
  it('reads the fixture workbook back through the Excel API', () => {
    expect(existsSync(CLI_PATH)).toBe(true);
    const folder = `msgraph-cli-test-sheet-${Date.now()}`;
    const path = `${folder}/msgraph-cli-sheet.fixture.xlsx`;

    expect(cli('files', 'mkdir', folder).ok).toBe(true);

    try {
      expect(cli('files', 'upload', FIXTURE_PATH, '--to-path', folder).ok).toBe(true);

      const list = cli<{ name: string; position: number }[]>('files', 'sheet', '--path', path, '--list');
      expect(list.data.map((x) => x.name)).toEqual(['People', 'Notes']);

      const first = cli<{ sheet: string; address: string; rows: unknown[][] }>('files', 'sheet', '--path', path);
      expect(first.data.sheet).toBe('People');
      expect(first.data.address).toBe('People!A1:E3');
      expect(first.data.rows).toEqual([
        ['Name', 'State', 'Count', '', 'Name'],
        ['Ada', 'CO', 3, 'x', 'A2'],
        ['Grace', 'TX', 5, 'y', 'B2']
      ]);

      const header = cli<{ rows: Record<string, unknown>[] }>('files', 'sheet', '--path', path, '--sheet', 'people', '--header');
      expect(header.data.rows[0]).toEqual({ Name: 'Ada', State: 'CO', Count: 3, column_4: 'x', Name_2: 'A2' });

      const range = cli<{ address: string; rows: unknown[][] }>('files', 'sheet', '--path', path, '--sheet', 'People', '--range', '$A$1:$B$2');
      expect(range.data).toMatchObject({
        address: 'People!A1:B2',
        rows: [
          ['Name', 'State'],
          ['Ada', 'CO']
        ]
      });

      const missing = cli('files', 'sheet', '--path', path, '--sheet', 'Georgia');
      expect(missing.ok).toBe(false);
      expect(missing.code).toBe('NOT_FOUND');
      expect(missing.suggestion).toContain('People, Notes');
    } finally {
      cli('files', 'delete', '--path', folder, '--yes');
    }
  }, 120000);
});
