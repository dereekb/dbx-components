import { describe, expect, it } from 'vitest';
import { assertLlmPromptContributionOccupancy, type LlmPromptContribution, type LlmPromptContributionCut, type LlmPromptContributor, type LlmPromptContributorParams, llmPromptContributionsInSlot, toLlmPromptSupplements, mergeLlmLiveContextContributions, resolveLlmPromptContributions } from './llm.prompt.contributor';
import { llmPromptCacheHash } from './llm.prompt.hash';
import { type LlmPromptLayout } from './llm.prompt.layout';
import { type LlmLiveContextBlock } from './llm.prompt.live.context';

const LAYOUT: LlmPromptLayout = [
  { id: 'addendum', role: 'model-addendum', occupancy: 'single', separator: '\n\n' },
  { id: 'tone', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'task', role: 'instructions', occupancy: 'single', separator: '\n\n' },
  { id: 'notes', role: 'craft', occupancy: 'many', separator: '\n\n' },
  { id: 'live', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' }
];

function contribution(slot: string, text: string, extra: Partial<LlmPromptContribution> = {}): LlmPromptContribution {
  return { contributor: 'alpha', slot, id: slot, text, origin: { kind: 'test' }, reason: `test ${slot}`, ...extra };
}

const INPUT: LlmPromptContributorParams = {
  request: { capability: 'summarize', renderLiveContext: () => [] },
  descriptor: undefined,
  templates: { roles: {}, byKey: () => undefined },
  liveBlockKeys: []
};

describe('resolveLlmPromptContributions()', () => {
  it('should return every contribution and cut in registry order', async () => {
    const alpha: LlmPromptContributor = { id: 'alpha', slots: ['tone', 'notes'], resolve: () => ({ contributions: [contribution('tone', 'T'), contribution('notes', 'N1')], cut: [{ contributor: 'alpha', slot: 'notes', id: 'notes', key: 'n2', text: 'N2', cut: 'cap' }] }) };
    const beta: LlmPromptContributor = { id: 'beta', slots: ['notes'], resolve: () => Promise.resolve({ contributions: [contribution('notes', 'N3', { contributor: 'beta' })] }) };
    const result = await resolveLlmPromptContributions([alpha, beta], INPUT);

    expect(result.contributions.map((x) => `${x.contributor}:${x.text}`)).toEqual(['alpha:T', 'alpha:N1', 'beta:N3']);
    expect(result.cut.map((x) => x.key)).toEqual(['n2']);
  });

  it('should resolve contributors sequentially', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const alpha: LlmPromptContributor = {
      id: 'alpha',
      slots: ['tone'],
      resolve: async () => {
        order.push('alpha:start');
        await gate;
        order.push('alpha:end');
        return { contributions: [] };
      }
    };
    const beta: LlmPromptContributor = {
      id: 'beta',
      slots: ['notes'],
      resolve: () => {
        order.push('beta:start');
        return { contributions: [] };
      }
    };
    const pending = resolveLlmPromptContributions([alpha, beta], INPUT);
    await Promise.resolve();

    expect(order).toEqual(['alpha:start']);
    release();
    await pending;
    expect(order).toEqual(['alpha:start', 'alpha:end', 'beta:start']);
  });

  it('should refuse a contribution in a slot its contributor did not declare', async () => {
    const rogue: LlmPromptContributor = { id: 'alpha', slots: ['tone'], resolve: () => ({ contributions: [contribution('live', 'speech')] }) };
    await expect(resolveLlmPromptContributions([rogue], INPUT)).rejects.toThrow(/offered a 'live' contribution/);
  });

  it('should refuse a contribution carrying another contributor id', async () => {
    const rogue: LlmPromptContributor = { id: 'alpha', slots: ['tone'], resolve: () => ({ contributions: [contribution('tone', 'T', { contributor: 'beta' })] }) };
    await expect(resolveLlmPromptContributions([rogue], INPUT)).rejects.toThrow(/contributor 'alpha' offered a 'tone' contribution as 'beta'/);
  });

  it('should refuse a cut carrying another contributor id', async () => {
    const rogue: LlmPromptContributor = { id: 'alpha', slots: ['notes'], resolve: () => ({ contributions: [], cut: [{ contributor: 'beta', slot: 'notes', id: 'notes', key: 'k', text: 'x', cut: 'cap' }] }) };
    await expect(resolveLlmPromptContributions([rogue], INPUT)).rejects.toThrow(/as 'beta'/);
  });

  it('should resolve an omitted cut to an empty array', async () => {
    const alpha: LlmPromptContributor = { id: 'alpha', slots: ['tone'], resolve: () => ({ contributions: [contribution('tone', 'T')] }) };
    const result = await resolveLlmPromptContributions([alpha], INPUT);
    expect(result.cut).toEqual([]);
  });
});

describe('llmPromptContributionsInSlot()', () => {
  it('should filter by slot and keep order', () => {
    const all = [contribution('notes', 'a'), contribution('tone', 'b'), contribution('notes', 'c')];
    expect(llmPromptContributionsInSlot(all, 'notes').map((x) => x.text)).toEqual(['a', 'c']);
  });
});

describe('assertLlmPromptContributionOccupancy()', () => {
  it('should fail loud when a single slot is held twice and allow a many slot to be', () => {
    expect(() => assertLlmPromptContributionOccupancy([contribution('tone', 'one'), contribution('tone', 'two', { contributor: 'beta' })], LAYOUT)).toThrow(/slot 'tone' holds one contribution, but both 'alpha' and 'beta' offered one/);
    expect(() => assertLlmPromptContributionOccupancy([contribution('notes', 'one'), contribution('notes', 'two')], LAYOUT)).not.toThrow();
  });

  it('should fail loud on an undeclared slot', () => {
    expect(() => assertLlmPromptContributionOccupancy([contribution('nope', 'x')], LAYOUT)).toThrow(/the layout declares no slot 'nope'/);
  });

  it('should fail loud on an assembly-owned slot', () => {
    expect(() => assertLlmPromptContributionOccupancy([contribution('task', 'x')], LAYOUT)).toThrow(/slot 'task' \(instructions\) is placed by the assembly/);
  });

  it('should let the live slot take many contributions', () => {
    expect(() => assertLlmPromptContributionOccupancy([contribution('live', 'a'), contribution('live', 'b'), contribution('addendum', 'c')], LAYOUT)).not.toThrow();
  });
});

describe('mergeLlmLiveContextContributions()', () => {
  const blocks: ReadonlyArray<LlmLiveContextBlock> = [
    { key: 'heading', text: 'H' },
    { key: 'members', text: 'M' },
    { key: 'vocabulary', text: 'V' }
  ];
  const keysOf = (merged: ReadonlyArray<LlmLiveContextBlock>): ReadonlyArray<string> => merged.map((block) => block.key);
  const merge = (contributions: ReadonlyArray<LlmPromptContribution>, from: ReadonlyArray<LlmLiveContextBlock> = blocks) => mergeLlmLiveContextContributions({ blocks: from, contributions, slot: 'live' });

  it('after: should insert right after the first block keyed k (in contribution order), else at the front', () => {
    const merged = merge([contribution('live', 'w', { key: 'writer', anchor: { after: 'heading' } }), contribution('live', 'w2', { key: 'writer-2', anchor: { after: 'heading' } }), contribution('live', 'x', { key: 'lost', anchor: { after: 'nope' } })]);
    expect(keysOf(merged)).toEqual(['lost', 'heading', 'writer', 'writer-2', 'members', 'vocabulary']);
  });

  it('before: should insert right before the first block keyed k, else at the end; no anchor goes to the end', () => {
    const merged = merge([contribution('live', 'r', { key: 'research', anchor: { before: 'vocabulary' } }), contribution('live', 'x', { key: 'lost', anchor: { before: 'nope' } }), contribution('live', 'n', { key: 'tail' })]);
    expect(keysOf(merged)).toEqual(['heading', 'members', 'research', 'vocabulary', 'lost', 'tail']);
  });

  it('should anchor an ordered key list on the first key the capability rendered', () => {
    const merged = merge([contribution('live', 'g', { key: 'guidance', anchor: { before: ['latent', 'vocabulary', 'members'] } }), contribution('live', 'a', { key: 'after', anchor: { after: ['brief', 'heading'] } }), contribution('live', 'x', { key: 'lost', anchor: { before: ['nope', 'none'] } })]);
    expect(keysOf(merged)).toEqual(['heading', 'after', 'members', 'guidance', 'vocabulary', 'lost']);
  });

  it('should return the same blocks array when the slot has no contribution', () => {
    expect(merge([contribution('tone', 'tone')])).toBe(blocks);
  });

  it('should merge before the empty-block filter (an empty block still anchors)', () => {
    const withEmpty: ReadonlyArray<LlmLiveContextBlock> = [{ key: 'heading', text: '' }, ...blocks.slice(1)];
    expect(keysOf(merge([contribution('live', 'W', { key: 'writer', anchor: { after: 'heading' } })], withEmpty))).toEqual(['heading', 'writer', 'members', 'vocabulary']);
  });

  it('should key a keyless contribution by its contributor id, carry its reason, and set volatile only when given', () => {
    const merged = merge([contribution('live', 'A'), contribution('live', 'B', { contributor: 'beta', key: 'b', volatile: false })]);
    expect(merged.slice(-2)).toEqual([
      { key: 'alpha', text: 'A', reason: 'test live' },
      { key: 'b', text: 'B', reason: 'test live', volatile: false }
    ]);
  });

  it('should anchor only on the first occurrence of a key', () => {
    const duplicated: ReadonlyArray<LlmLiveContextBlock> = [
      { key: 'row', text: '1' },
      { key: 'row', text: '2' }
    ];
    const merged = merge([contribution('live', 'x', { key: 'x', anchor: { after: 'row' } }), contribution('live', 'y', { key: 'y', anchor: { before: 'row' } })], duplicated);
    expect(merged.map((block) => `${block.key}:${block.text}`)).toEqual(['y:y', 'row:1', 'x:x', 'row:2']);
  });
});

describe('toLlmPromptSupplements()', () => {
  it('should build a placed row with its keys in the documented order', () => {
    const rows = toLlmPromptSupplements([contribution('notes', 'NOTE BODY', { key: 'note-a', tier: 'builtin', by: 'match', p: 0.8 })]);
    const row = rows[0];

    expect(row).toEqual({ contributor: 'alpha', slot: 'notes', id: 'notes', key: 'note-a', hash: llmPromptCacheHash('NOTE BODY'), bytes: 'NOTE BODY'.length, tier: 'builtin', by: 'match', p: 0.8 });
    expect(Object.keys(row)).toEqual(['contributor', 'slot', 'id', 'key', 'hash', 'bytes', 'tier', 'by', 'p']);
  });

  it('should omit key, tier, by and p when absent', () => {
    const row = toLlmPromptSupplements([contribution('tone', 'T')])[0];
    expect(Object.keys(row)).toEqual(['contributor', 'slot', 'id', 'hash', 'bytes']);
  });

  it('should list cut rows after placed rows with their cut reason', () => {
    const cut: LlmPromptContributionCut = { contributor: 'alpha', slot: 'notes', id: 'notes', key: 'note-b', text: 'CUT BODY', cut: 'unserved', tier: 'builtin' };
    const rows = toLlmPromptSupplements([contribution('tone', 'T')], [cut]);

    expect(rows.at(-1)).toEqual({ contributor: 'alpha', slot: 'notes', id: 'notes', key: 'note-b', hash: llmPromptCacheHash('CUT BODY'), bytes: 'CUT BODY'.length, tier: 'builtin', cut: 'unserved' });
    expect(Object.keys(rows.at(-1) ?? {})).toEqual(['contributor', 'slot', 'id', 'key', 'hash', 'bytes', 'tier', 'cut']);
  });

  it('should count bytes in UTF-16 code units', () => {
    expect(toLlmPromptSupplements([contribution('tone', 'ab🙂')])[0].bytes).toBe(4);
  });
});
