/**
 * Craft-note selection: tier shadowing and tombstones, the AND / OR `where` match, a missing fact, the guard, the rank
 * order, the judge cap, the verdicts (floor / unserved), and the budget's cut reasons.
 */

import { describe, expect, it } from 'vitest';
import { type LlmCraftNote } from './llm.craft.note';
import { resolveLlmCraftCandidates, llmCraftNoteMatchesSite, mergeLlmCraftNoteTiers, selectLlmCraftNotes } from './llm.craft.select';
import { DEFAULT_LLM_CRAFT_SITE_LIMITS, makeLlmCraftSiteRegistry } from './llm.craft.site';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] },
    'support-reply': { facts: { channel: 'closed', tags: 'open' }, inputs: ['message'], limits: { maxChars: 2400, judgeMax: 1 } },
    'release-notes': { facts: { audience: 'closed' }, inputs: ['summary'] }
  }
});

const PAGE = { kind: 'product-page', facts: { category: 'apparel', brand: 'acme', bundle: true }, inputs: { brief: 'a winter coat with no logo' } } as const;

/**
 * A loaded note with defaults.
 *
 * @param id - Its id.
 * @param overrides - Fields to override.
 * @returns The note.
 */
function note(id: string, overrides: Partial<LlmCraftNote> = {}): LlmCraftNote {
  return { id, title: id, sites: ['product-page'], where: {}, floor: 0.6, unserved: 'omit', priority: 4, enabled: true, body: `${id} body.`, tier: 'builtin', ...overrides };
}

describe('mergeLlmCraftNoteTiers()', () => {
  it('shadows by id: a later tier over an earlier one; a tombstone removes the id', () => {
    const merged = mergeLlmCraftNoteTiers([
      [note('a'), note('b'), note('c')],
      [note('a', { tier: 'machine', body: 'machine a' }), note('b', { tier: 'machine', enabled: false })],
      [note('a', { tier: 'workspace', body: 'workspace a' }), note('c', { tier: 'workspace', enabled: false }), note('d', { tier: 'workspace' })]
    ]);

    expect(merged.map((entry) => `${entry.id}:${entry.tier}`)).toEqual(['a:workspace', 'd:workspace']);
  });

  it('orders the merged notes by code unit — an uppercase id before a lowercase one', () => {
    expect(mergeLlmCraftNoteTiers([[note('b'), note('a'), note('B')]]).map((entry) => entry.id)).toEqual(['B', 'a', 'b']);
  });

  it('lets a higher tier re-enable an id a lower tier tombstoned', () => {
    expect(mergeLlmCraftNoteTiers([undefined, [note('a', { enabled: false })], [note('a', { tier: 'workspace' })]]).map((entry) => entry.tier)).toEqual(['workspace']);
  });
});

describe('llmCraftNoteMatchesSite()', () => {
  it('matches a list fact when any listed value does; an empty list is a missing fact', () => {
    const billing = note('billing-tone', { sites: ['support-reply'], where: { tags: ['billing', 'refund'] } });
    expect(llmCraftNoteMatchesSite(billing, { kind: 'support-reply', facts: { tags: ['login', 'refund'] } })).toBe(true);
    expect(llmCraftNoteMatchesSite(billing, { kind: 'support-reply', facts: { tags: ['login'] } })).toBe(false);
    expect(llmCraftNoteMatchesSite(billing, { kind: 'support-reply', facts: { tags: [] } })).toBe(false);
    expect(llmCraftNoteMatchesSite(billing, { kind: 'support-reply', facts: { tags: 'refund' } })).toBe(true);
  });
});

describe('selectLlmCraftNotes()', () => {
  it('matches the site kind, AND across where keys, OR within a list; a missing fact never matches', () => {
    const notes = [
      note('any-page'),
      note('apparel', { where: { category: ['apparel'] } }),
      note('apparel-or-shoes', { where: { category: ['shoes', 'apparel'] } }),
      note('apparel-acme', { where: { category: ['apparel'], brand: ['acme'] } }),
      note('apparel-other', { where: { category: ['apparel'], brand: ['other-brand'] } }),
      note('shoes', { where: { category: ['shoes'] } }),
      note('needs-material', { where: { material: ['wool'] } }),
      note('bundle', { where: { bundle: [true] } }),
      note('release-only', { sites: ['release-notes'] })
    ];
    const selection = selectLlmCraftNotes({ notes, site: PAGE, sites: SITES });

    expect([...selection.placed, ...selection.cut].map((entry) => entry.note.id).sort()).toEqual(['any-page', 'apparel', 'apparel-acme', 'apparel-or-shoes', 'bundle']);
  });

  it('matches nothing without a site, or with a kind that is not a craft site', () => {
    expect(selectLlmCraftNotes({ notes: [note('a')], site: undefined, sites: SITES })).toEqual({ placed: [], cut: [] });
    expect(selectLlmCraftNotes({ notes: [note('a')], site: { facts: { category: 'shoes' } }, sites: SITES })).toEqual({ placed: [], cut: [] });
    expect(selectLlmCraftNotes({ notes: [note('a', { sites: ['poster'] })], site: { kind: 'poster' }, sites: SITES })).toEqual({ placed: [], cut: [] });
  });

  it('guards a capability: every match is cut with the guard reason', () => {
    for (const guardCut of ['guard', 'audience-guard']) {
      const selection = selectLlmCraftNotes({ notes: [note('a'), note('b', { ask: '`brief` x' })], site: PAGE, sites: SITES, guardCut });
      expect(selection.placed).toEqual([]);
      expect(selection.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual([`a:${guardCut}`, `b:${guardCut}`]);
    }
  });

  it('ranks by priority desc, then specificity desc, then id', () => {
    const notes = [note('c-plain'), note('b-plain'), note('z-specific', { where: { category: ['apparel'], bundle: [true] } }), note('a-low', { priority: 1 }), note('y-high', { priority: 8 })];
    const selection = selectLlmCraftNotes({ notes, site: PAGE, sites: SITES });

    expect(selection.placed.map((placement) => placement.note.id)).toEqual(['y-high', 'z-specific', 'b-plain', 'c-plain']);
    expect(selection.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual(['a-low:max-notes']);
  });

  it('breaks a rank tie by code-unit id, so ids differing by case place the same on every host', () => {
    const notes = [note('b-plain'), note('a-plain'), note('B-plain')];
    const selection = selectLlmCraftNotes({ notes, site: PAGE, sites: SITES });

    expect(selection.placed.map((placement) => placement.note.id)).toEqual(['B-plain', 'a-plain', 'b-plain']);
  });

  it('places a stable note by match; a judged note by its verdict, its floor and its unserved posture', () => {
    const notes = [note('stable'), note('kept', { ask: '`brief` a' }), note('low', { ask: '`brief` b', floor: 0.9 }), note('unserved-omit', { ask: '`brief` c' }), note('unserved-include', { ask: '`brief` d', unserved: 'include' })];
    const selection = selectLlmCraftNotes({
      notes,
      site: PAGE,
      sites: SITES,
      verdicts: new Map([
        ['kept', 0.7],
        ['low', 0.8]
      ])
    });

    expect(selection.placed.map((placement) => `${placement.note.id}:${placement.by}:${placement.p ?? '-'}`)).toEqual(['kept:judge:0.7', 'stable:match:-', 'unserved-include:unserved:-']);
    expect(selection.cut.map((cut) => `${cut.note.id}:${cut.reason}:${cut.p ?? '-'}`)).toEqual(['low:floor:0.8', 'unserved-omit:unserved:-']);
  });

  it('with no judge at all, every asked note takes its unserved posture', () => {
    const selection = selectLlmCraftNotes({ notes: [note('omit', { ask: '`brief` a' }), note('include', { ask: '`brief` b', unserved: 'include' })], site: PAGE, sites: SITES });
    expect(selection.placed.map((placement) => `${placement.note.id}:${placement.by}`)).toEqual(['include:unserved']);
    expect(selection.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual(['omit:unserved']);
  });

  it("asks about at most the site's judgeMax judged notes; the rest are cut judge-cap", () => {
    const judgeMax = DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeMax;
    const judged = Array.from({ length: judgeMax + 2 }, (_, index) => note(`j${String(index).padStart(2, '0')}`, { ask: '`brief` x' }));
    const candidates = resolveLlmCraftCandidates({ notes: judged, site: PAGE, sites: SITES });

    expect(candidates.kind).toBe('product-page');
    expect(candidates.limits).toEqual(DEFAULT_LLM_CRAFT_SITE_LIMITS);
    expect(candidates.asked).toHaveLength(judgeMax);
    expect(candidates.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual(['j08:judge-cap', 'j09:judge-cap']);

    const reply = resolveLlmCraftCandidates({ notes: [note('r1', { sites: ['support-reply'], ask: '`message` x' }), note('r2', { sites: ['support-reply'], ask: '`message` y' })], site: { kind: 'support-reply' }, sites: SITES });
    expect(reply.asked.map((entry) => entry.id)).toEqual(['r1']);
    expect(reply.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual(['r2:judge-cap']);
  });

  it('caps the notes and the characters, skipping a note that does not fit and never truncating one', () => {
    const budget = DEFAULT_LLM_CRAFT_SITE_LIMITS.maxChars;
    const big = note('a-big', { priority: 8, body: 'x'.repeat(budget - 10) });
    const tooBig = note('b-too-big', { priority: 7, body: 'y'.repeat(20) });
    const fits = note('c-fits', { priority: 6, body: 'z'.repeat(10) });
    const selection = selectLlmCraftNotes({ notes: [big, tooBig, fits], site: PAGE, sites: SITES });

    expect(selection.placed.map((placement) => placement.note.id)).toEqual(['a-big', 'c-fits']);
    expect(selection.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual(['b-too-big:max-bytes']);
    expect(DEFAULT_LLM_CRAFT_SITE_LIMITS.maxNotes).toBe(4);
  });

  it("reads a site's own maxChars", () => {
    const reply = (id: string, length: number) => note(id, { sites: ['support-reply'], body: 'r'.repeat(length) });
    const selection = selectLlmCraftNotes({ notes: [reply('a', 2000), reply('b', 500)], site: { kind: 'support-reply' }, sites: SITES });

    expect(selection.placed.map((placement) => placement.note.id)).toEqual(['a']);
    expect(selection.cut.map((cut) => `${cut.note.id}:${cut.reason}`)).toEqual(['b:max-bytes']);
  });
});
