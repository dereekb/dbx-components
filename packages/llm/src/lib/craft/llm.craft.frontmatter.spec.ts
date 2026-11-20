/**
 * The craft-note parser: the accepted YAML subset, the schema (an unknown key refused), every cross-field refusal
 * with its line, tombstones, and the per-tier set loader.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_CRAFT_JUDGE_FLOOR, DEFAULT_LLM_CRAFT_NOTE_MAX_BYTES, DEFAULT_LLM_CRAFT_NOTE_PRIORITY } from './llm.craft.note';
import { llmCraftNoteParseErrorLines, parseLlmCraftNote, parseLlmCraftNoteSet } from './llm.craft.frontmatter';
import { makeLlmCraftSiteRegistry } from './llm.craft.site';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] },
    'support-reply': { facts: { channel: 'closed', tags: 'open' }, inputs: ['message'], limits: { maxBytes: 2400 } },
    'release-notes': { facts: { audience: 'closed' }, inputs: ['summary'] }
  }
});

/**
 * A note file from frontmatter lines and a body.
 *
 * @param frontmatter - The frontmatter lines.
 * @param body - The body.
 * @returns The file text.
 */
function noteText(frontmatter: ReadonlyArray<string>, body = 'Name what shows.'): string {
  return ['---', ...frontmatter, '---', body, ''].join('\n');
}

/**
 * The refusal lines of a parse that must fail.
 *
 * @param text - The file text.
 * @param sites - The registry to parse against.
 * @returns The `line N: message` lines.
 */
function refusalsOf(text: string, sites = SITES): ReadonlyArray<string> {
  const parsed = parseLlmCraftNote({ text, tier: 'machine', sites });
  expect(parsed.note).toBeUndefined();
  return llmCraftNoteParseErrorLines(parsed.errors ?? []);
}

const VALID = ['id: apparel-plain', 'title: Plain apparel pages', 'sites: [product-page, release-notes]'];

describe('parseLlmCraftNote()', () => {
  it('reads the full format: comments, a JSON-quoted ask, a flow list, the nested where, the defaults', () => {
    const text = noteText([
      'id: apparel-plain            # the id',
      'title: Plain apparel pages',
      'sites: [product-page, "support-reply"]   # two sites',
      '# a whole-line comment',
      'where:',
      '  category: [apparel]',
      '  bundle: true',
      'ask: "`brief` describes a garment with no logo. # not a comment"   # optional',
      'unserved: include'
    ]);
    const parsed = parseLlmCraftNote({ text, tier: 'builtin', source: 'apparel-plain.md', sites: SITES });

    expect(parsed.errors).toBeUndefined();
    expect(parsed.note).toEqual({
      id: 'apparel-plain',
      title: 'Plain apparel pages',
      sites: ['product-page', 'support-reply'],
      where: { category: ['apparel'], bundle: [true] },
      ask: '`brief` describes a garment with no logo. # not a comment',
      floor: DEFAULT_LLM_CRAFT_JUDGE_FLOOR,
      unserved: 'include',
      priority: DEFAULT_LLM_CRAFT_NOTE_PRIORITY,
      enabled: true,
      body: 'Name what shows.',
      tier: 'builtin',
      source: 'apparel-plain.md'
    });
    expect(Object.keys(parsed.note ?? {})).toEqual(['id', 'title', 'sites', 'where', 'ask', 'floor', 'unserved', 'priority', 'enabled', 'body', 'tier', 'source']);
  });

  it('normalizes a BOM and CRLF, and trims the body of blank lead lines and trailing space', () => {
    const text = `${String.fromCodePoint(0xfeff)}${['---', ...VALID, '---', '', '', '  Line one.', 'Line two.', '', ''].join('\r\n')}`;
    expect(parseLlmCraftNote({ text, tier: 'workspace', sites: SITES }).note?.body).toBe('  Line one.\nLine two.');
  });

  it('reads `sites` written as a `- item` block list', () => {
    const parsed = parseLlmCraftNote({ text: noteText(['id: apparel-plain', 'title: t', 'sites:', '  - product-page', '  - "release-notes"']), tier: 'machine', sites: SITES });
    expect(parsed.errors).toBeUndefined();
    expect(parsed.note?.sites).toEqual(['product-page', 'release-notes']);
  });

  it("reads a single-quoted title without its quotes, '' as '", () => {
    const parsed = parseLlmCraftNote({ text: noteText(['id: apparel-plain', "title: 'Plain apparel: it''s plain'", 'sites: [product-page]']), tier: 'machine', sites: SITES });
    expect(parsed.note?.title).toBe("Plain apparel: it's plain");
  });

  it('reads a tombstone with nothing but its id', () => {
    const parsed = parseLlmCraftNote({ text: noteText(['id: apparel-no-logo', 'enabled: false'], ''), tier: 'workspace', sites: SITES });
    expect(parsed.note).toMatchObject({ id: 'apparel-no-logo', enabled: false, sites: [], body: '', tier: 'workspace' });
  });

  it('refuses a missing or unclosed fence at line 1', () => {
    expect(refusalsOf('id: x\n')).toEqual(['line 1: a craft note opens with a `---` frontmatter fence']);
    expect(refusalsOf('---\nid: abc\n')).toEqual(['line 1: the frontmatter is never closed with a `---` line']);
  });

  it('refuses a malformed row at its line', () => {
    expect(refusalsOf(noteText([...VALID, 'not a row']))).toEqual(['line 5: expected `key: value`']);
    expect(refusalsOf(noteText([...VALID, '\tpriority: 2']))).toEqual(['line 5: indent with spaces, not tabs']);
    expect(refusalsOf(noteText([...VALID, '  category: [shoes]']))).toEqual(['line 5: `category` is indented, but no key above it opens a map']);
    expect(refusalsOf(noteText([...VALID, 'where:', '  category:']))).toEqual(['line 6: `where.category` has no value (only one level of nesting)']);
    expect(refusalsOf(noteText([...VALID, 'title: again']))).toEqual(['line 5: `title` is set twice']);
    expect(refusalsOf(noteText([...VALID, 'where:', '  category: shoes', '  category: shoes']))).toEqual(['line 7: `where.category` is set twice']);
  });

  it('refuses a malformed value at its line', () => {
    expect(refusalsOf(noteText([...VALID, 'ask: "`brief` unterminated']))).toEqual(['line 5: `ask`: an unterminated quoted string']);
    expect(refusalsOf(noteText([...VALID, 'where:', '  category: [shoes']))).toEqual(['line 6: `where.category`: an unclosed `[` list']);
    expect(refusalsOf(noteText([...VALID, 'where:', '  category: [shoes, ]']))).toEqual(['line 6: `where.category`: an empty list item']);
    expect(refusalsOf(noteText([...VALID, 'ask: "`brief`" trailing']))).toEqual(['line 5: `ask`: unexpected text after the value (quote a value that holds `"` or `[`)']);
  });

  it('refuses an unknown key and an out-of-range value through the schema, at the key line', () => {
    expect(refusalsOf(noteText([...VALID, 'colour: red']))).toEqual([expect.stringMatching(/^line 5: colour must be removed/)]);
    expect(refusalsOf(noteText([...VALID, 'floor: 2']))[0]).toMatch(/^line 5: floor must be at most 1/);
    expect(refusalsOf(noteText([...VALID, 'priority: 9']))[0]).toMatch(/^line 5: priority must be at most 8/);
    expect(refusalsOf(noteText([...VALID, 'priority: 1.5']))[0]).toMatch(/^line 5: priority must be an integer/);
    expect(refusalsOf(noteText([...VALID, 'unserved: maybe']))[0]).toMatch(/^line 5: unserved must be "include" or "omit"/);
  });

  it('refuses every cross-field rule at its line (the body has none)', () => {
    expect(refusalsOf(noteText(['id: Bad_Id', 'title: t', 'sites: [product-page]']))).toEqual(['line 2: id `Bad_Id` must match ^[a-z0-9][a-z0-9-]{1,63}$']);
    expect(refusalsOf(noteText(['id: abc', 'title: t', 'sites: [product-page, poster]']))).toEqual(['line 4: site `poster` is not a craft site (product-page, support-reply, release-notes)']);
    expect(refusalsOf(noteText(['id: abc', 'title: t', 'sites: [product-page, product-page]']))).toEqual(['line 4: a site is listed twice']);
    expect(refusalsOf(noteText(['id: abc', 'sites: [product-page]']))).toEqual(['an enabled note needs a `title`']);
    expect(refusalsOf(noteText(['id: abc', 'title: t']))).toEqual(['an enabled note needs at least one site']);
    expect(refusalsOf(noteText(VALID, ''))).toEqual(['an enabled note needs a body']);
    expect(refusalsOf(noteText(VALID, 'x'.repeat(DEFAULT_LLM_CRAFT_NOTE_MAX_BYTES + 1)))).toEqual([`the body is ${DEFAULT_LLM_CRAFT_NOTE_MAX_BYTES + 1} bytes; a note holds at most ${DEFAULT_LLM_CRAFT_NOTE_MAX_BYTES} (it is never truncated)`]);
  });

  it("refuses a body over the registry's own noteMaxBytes with that number", () => {
    const small = makeLlmCraftSiteRegistry({ sites: { 'product-page': { facts: {}, inputs: [] } }, noteMaxBytes: 20 });
    expect(refusalsOf(noteText(['id: abc', 'title: t', 'sites: [product-page]'], 'x'.repeat(21)), small)).toEqual(['the body is 21 bytes; a note holds at most 20 (it is never truncated)']);
  });

  it('refuses a where fact none of its sites carries, a value of the wrong shape, and an empty list', () => {
    expect(refusalsOf(noteText([...VALID, 'where:', '  channel: [email]']))).toEqual(['line 6: `channel` is not a fact of product-page / release-notes']);
    expect(refusalsOf(noteText([...VALID, 'where:', '  category: true']))).toEqual(['line 6: `where.category` takes words']);
    expect(refusalsOf(noteText(['id: abc', 'title: t', 'sites: [product-page]', 'where:', '  bundle: [yes]']))).toEqual(['line 6: `where.bundle` takes `true` / `false`']);
    expect(refusalsOf(noteText([...VALID, 'where:', '  category: []']))).toEqual(['line 6: `where.category` lists no value (it could never match)']);
  });

  it('refuses an ask that names none of its sites inputs in backticks', () => {
    expect(refusalsOf(noteText([...VALID, 'ask: "the brief is a plain garment"']))).toEqual(['line 5: the ask names no input of its sites in backticks (one of: brief, notes, summary)']);
    expect(refusalsOf(noteText([...VALID, 'ask: "`message` is empty"']))).toHaveLength(1);
    expect(parseLlmCraftNote({ text: noteText([...VALID, 'ask: "`summary` asks for a plain garment"']), tier: 'machine', sites: SITES }).note?.ask).toBe('`summary` asks for a plain garment');
  });
});

describe('parseLlmCraftNoteSet()', () => {
  it('loads a tier sorted by id with its tier, refusing a bad file and a second claim on one id', () => {
    const set = parseLlmCraftNoteSet({
      tier: 'machine',
      sites: SITES,
      files: [
        { source: 'b.md', text: noteText(['id: zeta-note', 'title: t', 'sites: [release-notes]']) },
        { source: 'a.md', text: noteText(['id: alpha-note', 'title: t', 'sites: [release-notes]']) },
        { source: 'c.md', text: noteText(['id: alpha-note', 'title: t', 'sites: [release-notes]']) },
        { source: 'd.md', text: 'no fence' }
      ]
    });

    expect(set.tier).toBe('machine');
    expect(set.notes.map((note) => `${note.id}@${note.source ?? ''}`)).toEqual(['alpha-note@a.md', 'zeta-note@b.md']);
    expect(set.refused.flatMap((refusal) => llmCraftNoteParseErrorLines(refusal.errors, refusal.source))).toEqual(['c.md: id `alpha-note` is already loaded from a.md in the machine tier', 'd.md: line 1: a craft note opens with a `---` frontmatter fence']);
  });

  it('gives a duplicate id to the first file in code-unit source order — an uppercase source before a lowercase one', () => {
    const set = parseLlmCraftNoteSet({
      tier: 'machine',
      sites: SITES,
      files: [
        { source: 'a.md', text: noteText(['id: shared-note', 'title: t', 'sites: [release-notes]']) },
        { source: 'B.md', text: noteText(['id: shared-note', 'title: t', 'sites: [release-notes]']) }
      ]
    });

    expect(set.notes.map((note) => `${note.id}@${note.source ?? ''}`)).toEqual(['shared-note@B.md']);
    expect(set.refused.map((refusal) => refusal.source)).toEqual(['a.md']);
  });
});
