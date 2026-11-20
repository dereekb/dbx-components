import { describe, expect, it } from 'vitest';
import {
  droppedLlmLiveContextBlockKeys,
  joinLlmLiveContextBlocks,
  LLM_CHAINED_FOLLOW_UP_DROPPED_LEAD,
  LLM_CHAINED_FOLLOW_UP_DROPPED_ROWS_LEAD,
  LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD,
  LLM_CHAINED_FOLLOW_UP_UNCHANGED_ROWS_LEAD,
  LLM_LIVE_CONTEXT_HEADING,
  llmChainedFollowUpBody,
  formatLlmFactRow,
  llmLiveContextBlock,
  llmLiveContextHeadingBlock,
  type LlmLiveContextBlock,
  type LlmLiveContextBlockOrder,
  llmLiveContextRowsBlock,
  llmLiveContextRowsText,
  mergeLlmChainedFollowUpBase,
  orderLlmLiveContextBlocks,
  toLlmLiveContextBlocks
} from './llm.prompt.live.context';

describe('llmChainedFollowUpBody()', () => {
  it('should send the whole live context with no base, and a new block whole', () => {
    const blocks = [
      { key: 'a', text: 'A' },
      { key: 'b', text: 'B' }
    ];
    expect(llmChainedFollowUpBody(blocks, undefined)).toBe('A\n\nB');
    expect(llmChainedFollowUpBody(blocks, [{ key: 'a', text: 'A' }])).toBe(`B\n\n${LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD} a.`);
  });

  const historyBlock = (rows: ReadonlyArray<{ readonly key: string; readonly text: string; readonly identity?: string }>, head = 'HISTORY'): LlmLiveContextBlock => llmLiveContextRowsBlock({ key: 'history', head, rows }) as LlmLiveContextBlock;

  it('should re-send a changed rows block as its head + only the new / changed rows, naming the rest', () => {
    const base = [
      historyBlock([
        { key: 't1', text: 'row 1' },
        { key: 't2', text: 'row 2' },
        { key: 't3', text: 'row 3' }
      ])
    ];
    const next = [
      historyBlock([
        { key: 't2', text: 'row 2' },
        { key: 't3', text: 'row 3 (landed)' },
        { key: 't4', text: 'row 4' }
      ])
    ];
    expect(llmChainedFollowUpBody(next, base)).toBe(`HISTORY\nrow 3 (landed)\nrow 4\n${LLM_CHAINED_FOLLOW_UP_UNCHANGED_ROWS_LEAD} t2. ${LLM_CHAINED_FOLLOW_UP_DROPPED_ROWS_LEAD} t1.`);
  });

  it('should treat rows with equal identities as unchanged even when their text was re-clipped', () => {
    const base = [historyBlock([{ key: 't1', text: 'row 1, the full intent', identity: 'ONE' }])];
    const clipped = [historyBlock([{ key: 't1', text: 'row 1…', identity: 'ONE' }])];
    expect(llmChainedFollowUpBody(clipped, base)).toBe(`${LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD} history.`);
  });

  it('should send the block whole on a changed head, or a text rewritten after the rows were built', () => {
    const base = [historyBlock([{ key: 't1', text: 'row 1' }])];
    expect(llmChainedFollowUpBody([historyBlock([{ key: 't1', text: 'row 1' }], 'HISTORY 2')], base)).toBe('HISTORY 2\nrow 1');
    const rewritten = {
      ...historyBlock([
        { key: 't1', text: 'row 1' },
        { key: 't2', text: 'row 2' }
      ]),
      text: 'HISTORY (trimmed)'
    };
    expect(llmChainedFollowUpBody([rewritten], base)).toBe('HISTORY (trimmed)');
  });

  it('should name a whole block the previous item showed and this one does not', () => {
    const previous = [
      { key: 'heading', text: 'H' },
      { key: 'focus', text: 'F' },
      { key: 'alert', text: 'STUCK' }
    ];
    const next = [
      { key: 'heading', text: 'H' },
      { key: 'focus', text: 'F2' }
    ];
    expect(llmChainedFollowUpBody(next, previous, previous)).toBe(`F2\n\n${LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD} heading.\n\n${LLM_CHAINED_FOLLOW_UP_DROPPED_LEAD} alert.`);
    // A previous render that shares only the heading names nothing as dropped.
    expect(
      llmChainedFollowUpBody(next, previous, [
        { key: 'heading', text: 'H' },
        { key: 'research', text: 'R' }
      ])
    ).toBe(`F2\n\n${LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD} heading.`);
  });
});

describe('orderLlmLiveContextBlocks()', () => {
  const ORDER: LlmLiveContextBlockOrder = { heading: 0, identity: 10, history: 50, footer: 200 };
  const DEFAULT_ORDER = 100;
  const KEYS = ['footer', 'history', 'identity', 'heading', 'notes', 'alpha', 'zeta', 'beta', 'gamma', 'delta'];
  const keysOf = (blocks: ReadonlyArray<{ readonly key: string }>): ReadonlyArray<string> => blocks.map((block) => block.key);
  const ordered = (keys: ReadonlyArray<string>): ReadonlyArray<string> =>
    keysOf(
      orderLlmLiveContextBlocks(
        keys.map((key) => ({ key })),
        ORDER,
        DEFAULT_ORDER
      )
    );

  it('should order by rank, then key', () => {
    expect(ordered(KEYS)).toEqual(['heading', 'identity', 'history', 'alpha', 'beta', 'delta', 'gamma', 'notes', 'zeta', 'footer']);
  });

  it('should be invariant under any permutation of its input', () => {
    const expected = ordered(KEYS);
    expect(ordered(KEYS.toReversed())).toEqual(expected);
    expect(ordered(KEYS.toSorted())).toEqual(expected);
    // A deterministic shuffle — no RNG, so a failure is reproducible.
    expect(
      ordered(
        KEYS.map((key, index) => ({ key, at: (index * 7) % KEYS.length }))
          .toSorted((a, b) => a.at - b.at)
          .map(({ key }) => key)
      )
    ).toEqual(expected);
  });

  it('should land an unknown key at the default rank, tiebroken alphabetically', () => {
    expect(ordered(['footer', 'zeta-unknown', 'alpha-unknown', 'heading'])).toEqual(['heading', 'alpha-unknown', 'zeta-unknown', 'footer']);
  });

  it('should tie-break by code unit, never the host locale — uppercase before lowercase', () => {
    expect(ordered(['alpha', 'Beta'])).toEqual(['Beta', 'alpha']);
    expect(ordered(['Beta', 'alpha'])).toEqual(['Beta', 'alpha']);
  });

  it('should preserve the blocks themselves, not just their keys', () => {
    const blocks = [
      { key: 'history', text: 'S' },
      { key: 'heading', text: 'H' }
    ];
    expect(orderLlmLiveContextBlocks(blocks, ORDER, DEFAULT_ORDER)).toEqual([
      { key: 'heading', text: 'H' },
      { key: 'history', text: 'S' }
    ]);
  });

  it('should not mutate its input', () => {
    const blocks = [{ key: 'history' }, { key: 'heading' }];
    orderLlmLiveContextBlocks(blocks, ORDER, DEFAULT_ORDER);
    expect(keysOf(blocks)).toEqual(['history', 'heading']);
  });
});

describe('llmLiveContextBlock()', () => {
  it('should join lines with a newline and drop nullish lines', () => {
    expect(llmLiveContextBlock({ key: 'k', lines: ['a', undefined, null, 'b'] })).toEqual({ key: 'k', text: 'a\nb' });
  });

  it('should take a string body as-is', () => {
    expect(llmLiveContextBlock({ key: 'k', lines: 'body' })).toEqual({ key: 'k', text: 'body' });
  });

  it('should return undefined for a blank body', () => {
    expect(llmLiveContextBlock({ key: 'k', lines: '  \n ' })).toBeUndefined();
    expect(llmLiveContextBlock({ key: 'k', lines: [undefined] })).toBeUndefined();
  });

  it('should carry reason only when set', () => {
    expect(llmLiveContextBlock({ key: 'k', lines: 'x', reason: 'why' })).toEqual({ key: 'k', text: 'x', reason: 'why' });
    expect(Object.keys(llmLiveContextBlock({ key: 'k', lines: 'x' }) ?? {})).toEqual(['key', 'text']);
  });
});

describe('llmLiveContextHeadingBlock()', () => {
  it('should return the heading block', () => {
    expect(llmLiveContextHeadingBlock()).toEqual({ key: 'heading', text: LLM_LIVE_CONTEXT_HEADING });
  });
});

describe('formatLlmFactRow()', () => {
  it('should keep 0 and drop empty and nullish values', () => {
    expect(
      formatLlmFactRow([
        ['a', 'x'],
        ['b', 0],
        ['c', ''],
        ['d', undefined],
        ['e', null],
        ['f', 2]
      ])
    ).toBe('a: x; b: 0; f: 2');
  });
});

describe('joinLlmLiveContextBlocks()', () => {
  it('should filter empty texts before joining', () => {
    expect(
      joinLlmLiveContextBlocks([
        { key: 'a', text: 'A' },
        { key: 'b', text: '' },
        { key: 'c', text: 'C' }
      ])
    ).toBe('A\n\nC');
  });
});

describe('toLlmLiveContextBlocks()', () => {
  it('should map an empty string to no blocks', () => {
    expect(toLlmLiveContextBlocks('')).toEqual([]);
  });

  it('should wrap a string in one live-context block', () => {
    expect(toLlmLiveContextBlocks('facts')).toEqual([{ key: 'live-context', text: 'facts' }]);
  });

  it('should pass an array through', () => {
    const blocks = [{ key: 'a', text: 'A' }];
    expect(toLlmLiveContextBlocks(blocks)).toBe(blocks);
  });
});

describe('llmLiveContextRowsText() / llmLiveContextRowsBlock()', () => {
  it('should join head and rows, dropping an empty head', () => {
    expect(llmLiveContextRowsText('H', [{ text: 'a' }, { text: 'b' }])).toBe('H\na\nb');
    expect(llmLiveContextRowsText('', [{ text: 'a' }])).toBe('a');
    expect(llmLiveContextRowsText(undefined, [{ text: 'a' }])).toBe('a');
  });

  it('should drop a blank head and return undefined with no rows', () => {
    expect(llmLiveContextRowsBlock({ key: 'k', head: '  ', rows: [{ key: 'r', text: 'a' }] })).toEqual({ key: 'k', text: 'a', rows: [{ key: 'r', text: 'a' }] });
    expect(llmLiveContextRowsBlock({ key: 'k', head: 'H', rows: [] })).toBeUndefined();
  });

  it('should spread volatile and reason only when set', () => {
    const block = llmLiveContextRowsBlock({ key: 'k', head: 'H', rows: [{ key: 'r', text: 'a' }], reason: 'why', volatile: false });
    expect(block).toEqual({ key: 'k', text: 'H\na', head: 'H', rows: [{ key: 'r', text: 'a' }], reason: 'why', volatile: false });
    expect(Object.keys(llmLiveContextRowsBlock({ key: 'k', rows: [{ key: 'r', text: 'a' }] }) ?? {})).toEqual(['key', 'text', 'rows']);
  });
});

describe('droppedLlmLiveContextBlockKeys()', () => {
  it('should name previous blocks missing now, only when a non-heading key is shared', () => {
    const now = [
      { key: 'heading', text: 'H' },
      { key: 'focus', text: 'F' }
    ];
    expect(
      droppedLlmLiveContextBlockKeys(now, [
        { key: 'heading', text: 'H' },
        { key: 'focus', text: 'F' },
        { key: 'alert', text: 'A' },
        { key: 'empty', text: '' }
      ])
    ).toEqual(['alert']);
    expect(
      droppedLlmLiveContextBlockKeys(now, [
        { key: 'heading', text: 'H' },
        { key: 'other', text: 'O' }
      ])
    ).toEqual([]);
    expect(droppedLlmLiveContextBlockKeys(now, undefined)).toEqual([]);
  });
});

describe('mergeLlmChainedFollowUpBase()', () => {
  it('should accumulate the base, let sent blocks overwrite, and remove dropped keys', () => {
    const base = [
      { key: 'a', text: 'A' },
      { key: 'b', text: 'B' },
      { key: 'c', text: 'C' }
    ];
    const sent = [{ key: 'b', text: 'B2' }];
    expect(mergeLlmChainedFollowUpBase(base, sent, ['c'])).toEqual([
      { key: 'a', text: 'A' },
      { key: 'b', text: 'B2' }
    ]);
  });

  it('should return the sent blocks with no base', () => {
    const sent = [{ key: 'a', text: 'A' }];
    expect(mergeLlmChainedFollowUpBase(undefined, sent)).toEqual(sent);
  });
});
