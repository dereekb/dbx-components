import { describe, expect, it } from 'vitest';
import { llmCraftNoteParseErrorLines } from './llm.craft.frontmatter';
import { toLlmCraftNoteRowSource, llmCraftNoteTombstoneText, makeLlmCraftNoteRowReader, parseLlmCraftNoteRows, type LlmCraftNoteRow } from './llm.craft.row';
import { makeLlmCraftSiteRegistry } from './llm.craft.site';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] }
  }
});

function noteText(id: string, body = 'WORKSPACE BODY'): string {
  return ['---', `id: ${id}`, 'title: t', 'sites: [product-page]', '---', body, ''].join('\n');
}

describe('toLlmCraftNoteRowSource()', () => {
  it('reads <tier>:<id>', () => {
    expect(toLlmCraftNoteRowSource('workspace', 'a')).toBe('workspace:a');
  });
});

describe('llmCraftNoteTombstoneText()', () => {
  it('is the minimal tombstone note', () => {
    expect(llmCraftNoteTombstoneText('apparel-plain')).toBe('---\nid: apparel-plain\nenabled: false\n---\n');
  });
});

describe('parseLlmCraftNoteRows()', () => {
  it('parses a live row into the tier', () => {
    const set = parseLlmCraftNoteRows({ rows: [{ id: 'apparel-plain', text: noteText('apparel-plain') }], tier: 'workspace', sites: SITES });

    expect(set.tier).toBe('workspace');
    expect(set.refused).toEqual([]);
    expect(set.notes).toEqual([expect.objectContaining({ id: 'apparel-plain', tier: 'workspace', source: 'workspace:apparel-plain', body: 'WORKSPACE BODY' })]);
  });

  it('parses an enabled: false row as the tombstone, even with broken text', () => {
    const set = parseLlmCraftNoteRows({ rows: [{ id: 'apparel-plain', text: 'not a note at all', enabled: false }], tier: 'workspace', sites: SITES });

    expect(set.refused).toEqual([]);
    expect(set.notes).toEqual([expect.objectContaining({ id: 'apparel-plain', enabled: false, body: '' })]);
  });

  it('refuses a renamed row, and a broken row with its parse errors under its source', () => {
    const set = parseLlmCraftNoteRows({
      rows: [
        { id: 'renamed', text: noteText('other-id') },
        { id: 'broken', text: 'no fence' }
      ],
      tier: 'workspace',
      sites: SITES
    });

    expect(set.notes).toEqual([]);
    expect(set.refused.flatMap((refusal) => llmCraftNoteParseErrorLines(refusal.errors, refusal.source))).toEqual(['workspace:broken: line 1: a craft note opens with a `---` frontmatter fence', 'workspace:renamed: the note id `other-id` is not its row id']);
  });
});

describe('makeLlmCraftNoteRowReader()', () => {
  it('returns the SAME set for equal content and reparses on a changed text or posture', () => {
    const read = makeLlmCraftNoteRowReader({ tier: 'workspace', sites: SITES });
    const rows: ReadonlyArray<LlmCraftNoteRow> = [{ id: 'apparel-plain', text: noteText('apparel-plain') }];
    const first = read(rows);

    expect(read([{ ...rows[0] }])).toBe(first);

    const changed = read([{ id: 'apparel-plain', text: noteText('apparel-plain', 'NEW BODY') }]);
    expect(changed).not.toBe(first);
    expect(changed.notes[0].body).toBe('NEW BODY');

    const hidden = read([{ id: 'apparel-plain', text: noteText('apparel-plain', 'NEW BODY'), enabled: false }]);
    expect(hidden).not.toBe(changed);
    expect(hidden.notes[0].enabled).toBe(false);
  });

  it('reads no rows as an empty tier', () => {
    const read = makeLlmCraftNoteRowReader({ tier: 'workspace', sites: SITES });
    expect(read(null)).toEqual({ tier: 'workspace', notes: [], refused: [] });
    expect(read([])).toEqual({ tier: 'workspace', notes: [], refused: [] });
  });
});
