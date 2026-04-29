/**
 * Integration spec — drives the parser against the real
 * `apps/demo-api/src/test/fixture.ts` to confirm the extractor handles
 * the file's actual structure end-to-end (13 triplets at time of writing).
 *
 * Numbers are loose so the test doesn't churn every time the fixture file
 * gains a new model.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractAppFixturesFromText } from './extract.js';

describe('extractAppFixturesFromText — apps/demo-api fixture', () => {
  it('parses the real demo-api fixture file', async () => {
    const path = resolve(__dirname, '../../../../../apps/demo-api/src/test/fixture.ts');
    const text = await readFile(path, 'utf8');
    const extraction = extractAppFixturesFromText({ text, fixturePath: 'apps/demo-api/src/test/fixture.ts' });
    expect(extraction.prefix).toBe('DemoApi');
    expect(extraction.entries.length).toBeGreaterThanOrEqual(8);
    const models = extraction.entries.map((e) => e.model);
    expect(models).toContain('Profile');
    expect(models).toContain('Guestbook');
    expect(models).toContain('GuestbookEntry');
    expect(models).toContain('StorageFile');
    expect(models).toContain('NotificationBox');
    const guestbookEntry = extraction.entries.find((e) => e.model === 'GuestbookEntry');
    expect(guestbookEntry?.archetype).toBe('sub-collection-traversal');
    const storageFile = extraction.entries.find((e) => e.model === 'StorageFile');
    expect(storageFile?.fixtureMethods.map((m) => m.name)).toContain('process');
    expect(storageFile?.instanceMethods.map((m) => m.name)).toContain('process');
  });
});
