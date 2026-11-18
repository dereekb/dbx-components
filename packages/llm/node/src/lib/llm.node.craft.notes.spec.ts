import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeLlmCraftSiteRegistry } from '@dereekb/llm';
import { loadLlmCraftNotes, readLlmCraftNoteFiles, resolveLlmCraftNotesDir } from './llm.node.craft.notes';
import { DEFAULT_LLM_ENV_NAMES, type LlmEnvNames } from './llm.node.env';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] },
    'release-notes': { facts: { audience: 'closed' }, inputs: ['summary'] }
  }
});

const GOOD = '---\nid: apparel-plain\ntitle: Plain apparel pages\nsites: [product-page]\nwhere:\n  category: [apparel]\n---\nName the fabric first.\n';
const BAD = '---\nid: no-title\nsites: [product-page]\ncolour: red\n---\nbody\n';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'llm-node-craft-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('resolveLlmCraftNotesDir()', () => {
  it('reads LLM_CRAFT_NOTES_DIR, trimmed', () => {
    expect(resolveLlmCraftNotesDir({ env: { LLM_CRAFT_NOTES_DIR: '  /notes/here  ' }, defaultDir: '/default' })).toBe('/notes/here');
  });

  it('falls back to the default folder when the var is blank or absent', () => {
    expect(resolveLlmCraftNotesDir({ env: { LLM_CRAFT_NOTES_DIR: '   ' }, defaultDir: '/default' })).toBe('/default');
    expect(resolveLlmCraftNotesDir({ env: {}, defaultDir: '/default' })).toBe('/default');
  });

  it('reads custom names, and never reads the env with names that carry no craftNotesDir', () => {
    const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, craftNotesDir: ['APP_CRAFT_DIR'] };
    expect(resolveLlmCraftNotesDir({ env: { APP_CRAFT_DIR: '/app', LLM_CRAFT_NOTES_DIR: '/llm' }, names, defaultDir: '/default' })).toBe('/app');

    const { craftNotesDir: _omitted, ...without } = DEFAULT_LLM_ENV_NAMES;
    expect(resolveLlmCraftNotesDir({ env: { LLM_CRAFT_NOTES_DIR: '/llm' }, names: without, defaultDir: '/default' })).toBe('/default');
  });
});

describe('readLlmCraftNoteFiles()', () => {
  it('reads *.md but the README, not recursing, sorted by name', () => {
    writeFileSync(join(dir, 'b.md'), 'B');
    writeFileSync(join(dir, 'a.md'), 'A');
    writeFileSync(join(dir, 'README.md'), 'people only');
    writeFileSync(join(dir, 'notes.txt'), 'not a note');
    mkdirSync(join(dir, 'nested'));
    writeFileSync(join(dir, 'nested', 'c.md'), 'C');

    expect(readLlmCraftNoteFiles(dir)).toEqual([
      { source: 'a.md', text: 'A' },
      { source: 'b.md', text: 'B' }
    ]);
  });

  it('reads a missing path or a file path as no files', () => {
    const file = join(dir, 'a.md');
    writeFileSync(file, 'A');

    expect(readLlmCraftNoteFiles(join(dir, 'missing'))).toEqual([]);
    expect(readLlmCraftNoteFiles(file)).toEqual([]);
  });
});

describe('loadLlmCraftNotes()', () => {
  it('loads the good note into the tier and drops and warns about the refused one', () => {
    writeFileSync(join(dir, 'apparel-plain.md'), GOOD);
    writeFileSync(join(dir, 'no-title.md'), BAD);
    const warned: string[] = [];
    const set = loadLlmCraftNotes({ dir, tier: 'machine', sites: SITES, warn: (message) => warned.push(message) });

    expect(set.tier).toBe('machine');
    expect(set.notes.map((note) => [note.id, note.tier, note.where])).toEqual([['apparel-plain', 'machine', { category: ['apparel'] }]]);
    expect(set.refused.map((refusal) => refusal.source)).toEqual(['no-title.md']);
    expect(warned.length).toBeGreaterThan(0);

    for (const line of warned) {
      expect(line.startsWith('craft notes: skipped ')).toBe(true);
      expect(line).toContain(join(dir, 'no-title.md'));
      expect(line.endsWith('\n')).toBe(true);
    }
  });

  it('loads a missing folder as no notes, with no warning', () => {
    const warned: string[] = [];
    expect(loadLlmCraftNotes({ dir: join(dir, 'missing'), tier: 'machine', sites: SITES, warn: (message) => warned.push(message) })).toEqual({ tier: 'machine', notes: [], refused: [] });
    expect(warned).toEqual([]);
  });

  it('swallows an unreadable folder, warns once naming it, and loads no notes', () => {
    writeFileSync(join(dir, 'apparel-plain.md'), GOOD);
    mkdirSync(join(dir, 'broken.md'));
    const warned: string[] = [];
    const swallowed: string[] = [];
    const set = loadLlmCraftNotes({ dir, tier: 'machine', sites: SITES, warn: (message) => warned.push(message), swallow: (site) => swallowed.push(site) });

    expect(swallowed).toEqual(['llm/craft-notes.folder-read']);
    expect(warned).toHaveLength(1);
    expect(warned[0].startsWith(`craft notes: could not read ${dir}: `)).toBe(true);
    expect(warned[0].endsWith('\n')).toBe(true);
    expect(set).toEqual({ tier: 'machine', notes: [], refused: [] });
  });
});
