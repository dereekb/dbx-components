/**
 * The LIVE CONTEXT — a capability's volatile, per-call facts — as **keyed blocks** rather than one pre-joined string.
 *
 * Rendering the live context as one string expresses section boundaries only as blank-line entries inside it, so
 * nothing downstream can name a section: a prompt inspector sees one large block called "live context", and a diff
 * of two consecutive calls cannot say WHICH part of the context moved.
 *
 * An {@link LlmLiveContextBlock} is one section plus the key that names it and (optionally) the gate that admitted
 * it. {@link joinLlmLiveContextBlocks} joins them with `'\n\n'`, so a block-shaped render is byte-identical to the
 * string it replaces whenever the original sections were blank-line separated. Each block becomes one prompt segment
 * in the live slot.
 *
 * The chained follow-up instance (which re-sends only what changed since the thread's last turn) builds on
 * {@link llmChainedFollowUpBody} and {@link mergeLlmChainedFollowUpBase}.
 */

import { type Maybe } from '@dereekb/util';

/**
 * ONE keyed section of a capability's live context.
 */
export interface LlmLiveContextBlock {
  /**
   * The block's key — a kebab-case noun, UNIQUE within one live context (`'heading'`, `'subject'`, `'history'`, …).
   * This is the identity a cross-call diff folds on, so it must name the SLOT, not its contents.
   */
  readonly key: string;
  /**
   * The block's rendered text, WITHOUT the separator that joins it to the next block.
   */
  readonly text: string;
  /**
   * WHY this block is present — the gate, in one sentence. Absent for an unconditional block whose key already says
   * everything.
   */
  readonly reason?: string;
  /**
   * Whether this block's bytes MOVE between two consecutive calls of the same capability for the same subject.
   * **Absent ⇒ `true`** — the correct default: the live context is the volatile layer, and a block that has not
   * thought about the question must not claim stability it does not have.
   *
   * `false` is a CLAIM, made by a capability that has ordered its live context SLOW→FAST and can say which leading
   * blocks are the slow ones (an identity brief; the heading). The claim is what lets `llmPromptCacheSegmentsOf` put
   * the cache split where the reorder actually created it, instead of pinning it at the first live-context byte —
   * without which a cache-prefix hash cannot see a live-context reorder AT ALL, and only the provider's own counter
   * can.
   *
   * It changes NO wire bytes on a transport that never reads the cache split; on a breakpoint-caching route it moves
   * the cache breakpoint to the right place. A false claim is not silent either: a prefix-change report names the
   * block that moved.
   */
  readonly volatile?: boolean;
  /**
   * The block's leading line(s) when it is a ROWS block ({@link llmLiveContextRowsBlock}) — the header its
   * {@link rows} follow. Present only alongside `rows`.
   */
  readonly head?: string;
  /**
   * The block's keyed rows when it is a ROWS block — `text` is {@link head} + these rows joined by `'\n'`. The
   * structure changes no root bytes; it is what lets a chained follow-up re-send only the rows that changed
   * ({@link llmChainedFollowUpBody}) instead of the whole block.
   */
  readonly rows?: ReadonlyArray<LlmLiveContextRow>;
}

/**
 * ONE keyed row of a rows block ({@link LlmLiveContextBlock.rows}) — a history entry, a list item.
 */
export interface LlmLiveContextRow {
  /**
   * The row's key, UNIQUE within its block — what a follow-up names when the row did not change.
   */
  readonly key: string;
  /**
   * The row's rendered text (may span several lines).
   */
  readonly text: string;
  /**
   * What the row MEANS, when its rendering can change cosmetically without its content changing (a history row going
   * from full to clipped as newer entries land). Two rows with equal identities count as unchanged even when their
   * texts differ; absent on either side ⇒ the texts compare.
   */
  readonly identity?: string;
}

/**
 * What the assembly accepts as a live context: the keyed blocks a capability renders, OR a flat string (an ad-hoc
 * probe context, and any caller holding pre-joined bytes). A string becomes ONE block keyed
 * {@link LLM_FLAT_LIVE_CONTEXT_BLOCK_KEY}, so the segment path has no second shape to handle.
 */
export type LlmLiveContextInput = string | ReadonlyArray<LlmLiveContextBlock>;

/**
 * The `## Live context` heading a capability's live context opens with.
 */
export const LLM_LIVE_CONTEXT_HEADING = '## Live context';

/**
 * The key {@link llmLiveContextHeadingBlock} uses.
 */
export const LLM_LIVE_CONTEXT_HEADING_BLOCK_KEY = 'heading';

/**
 * The key a FLAT string live context is wrapped under by {@link toLlmLiveContextBlocks} — the one block whose text is
 * the whole pre-joined context, with no section breakdown to offer.
 */
export const LLM_FLAT_LIVE_CONTEXT_BLOCK_KEY = 'live-context';

/**
 * The separator between rendered live-context blocks — a blank line, so blocks read as distinct sections. A
 * block-shaped render of an already blank-line-separated string is therefore byte-identical.
 */
export const LLM_LIVE_CONTEXT_BLOCK_SEPARATOR = '\n\n';

/**
 * The `## Live context` heading as its own block — a capability's live context opens with it, so it gets one helper
 * rather than a copy of the same literal per capability.
 *
 * @returns The heading block.
 *
 * @example
 * ```ts
 * const blocks = [llmLiveContextHeadingBlock(), llmLiveContextBlock({ key: 'subject', lines: ['Subject: a lamp'] })];
 * ```
 */
export function llmLiveContextHeadingBlock(): LlmLiveContextBlock {
  return { key: LLM_LIVE_CONTEXT_HEADING_BLOCK_KEY, text: LLM_LIVE_CONTEXT_HEADING };
}

/**
 * The inputs {@link llmLiveContextBlock} builds one block from.
 */
export interface LlmLiveContextBlockConfig {
  /**
   * The block's key ({@link LlmLiveContextBlock.key}).
   */
  readonly key: string;
  /**
   * The block's body — either the already-rendered text, or the lines to join with `'\n'` (nullish entries dropped,
   * so a conditional line stays an inline `cond ? x : undefined` rather than a spread).
   */
  readonly lines: ReadonlyArray<Maybe<string>> | string;
  /**
   * WHY the block is present ({@link LlmLiveContextBlock.reason}).
   */
  readonly reason?: string;
}

/**
 * Build one live-context block, or `undefined` when it would be EMPTY.
 *
 * Returning `undefined` for an empty body is the point: it lets a conditional section stay one entry in the block
 * array (`filterMaybeArrayValues` drops it) instead of a conditional spread, and it guarantees no interior empty block
 * can inject a stray blank line into the joined live context.
 *
 * @param config - The key, the body lines (or text), and the optional admission reason.
 * @returns The block, or `undefined` when its body is blank.
 *
 * @example
 * ```ts
 * llmLiveContextBlock({ key: 'subject', lines: ['Subject: a lamp', undefined, 'Price: 20'] });
 * // { key: 'subject', text: 'Subject: a lamp\nPrice: 20' }
 * ```
 */
export function llmLiveContextBlock(config: LlmLiveContextBlockConfig): Maybe<LlmLiveContextBlock> {
  const { key, lines, reason } = config;
  const text = typeof lines === 'string' ? lines : lines.filter((line): line is string => line != null).join('\n');
  return text.trim() === '' ? undefined : { key, text, ...(reason == null ? {} : { reason }) };
}

/**
 * One `key: value; …` FACT ROW — the terse register a block only a model reads prints. An absent or empty value drops
 * its pair (a `0` is kept), so a conditional cell stays one entry.
 *
 * @param pairs - The `[key, value]` pairs, in print order.
 * @returns The row.
 *
 * @example
 * ```ts
 * llmFactRowOf([['size', 'large'], ['count', 0], ['color', undefined]]); // 'size: large; count: 0'
 * ```
 */
export function llmFactRowOf(pairs: ReadonlyArray<readonly [string, Maybe<string | number>]>): string {
  return pairs
    .filter((pair): pair is readonly [string, string | number] => pair[1] != null && pair[1] !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

/**
 * Join live-context blocks into the rendered live-context string — non-empty texts joined by
 * {@link LLM_LIVE_CONTEXT_BLOCK_SEPARATOR}. Empty texts are FILTERED first so an interior empty block can never inject
 * a stray blank line.
 *
 * @param blocks - The blocks in render order.
 * @returns The joined live context.
 *
 * @example
 * ```ts
 * joinLlmLiveContextBlocks([{ key: 'a', text: 'A' }, { key: 'b', text: '' }, { key: 'c', text: 'C' }]); // 'A\n\nC'
 * ```
 */
export function joinLlmLiveContextBlocks(blocks: ReadonlyArray<LlmLiveContextBlock>): string {
  return blocks
    .map((block) => block.text)
    .filter((text) => text.length > 0)
    .join(LLM_LIVE_CONTEXT_BLOCK_SEPARATOR);
}

/**
 * Normalize an {@link LlmLiveContextInput} to blocks — a string becomes ONE {@link LLM_FLAT_LIVE_CONTEXT_BLOCK_KEY}
 * block (empty ⇒ NO blocks), an array passes through.
 *
 * @param input - The blocks or the pre-joined string.
 * @returns The blocks.
 *
 * @example
 * ```ts
 * toLlmLiveContextBlocks('Facts'); // [{ key: 'live-context', text: 'Facts' }]
 * toLlmLiveContextBlocks(''); // []
 * ```
 */
export function toLlmLiveContextBlocks(input: LlmLiveContextInput): ReadonlyArray<LlmLiveContextBlock> {
  let blocks: ReadonlyArray<LlmLiveContextBlock>;

  if (typeof input === 'string') {
    blocks = input.length === 0 ? [] : [{ key: LLM_FLAT_LIVE_CONTEXT_BLOCK_KEY, text: input }];
  } else {
    blocks = input;
  }

  return blocks;
}

/**
 * A SPARSE order table for live-context blocks — block KEY → its render rank, lower first. Sparse on purpose (gaps
 * between bands): a new block slots between two existing ones without renumbering, and renumbering is exactly what
 * would move bytes that had no reason to move.
 *
 * A key the table does not carry falls to the caller's default rank; {@link orderLlmLiveContextBlocks} then breaks
 * the tie by KEY NAME, never by array position.
 */
export type LlmLiveContextBlockOrder = Readonly<Record<string, number>>;

/**
 * Sort live-context blocks into a capability's declared RENDER order — the pair `(order[key] ?? defaultOrder, key)`.
 *
 * The pair is the point. Array position is how a capability's block set READS in source (the order a person
 * assembles it in), and that is a different concern from the order the bytes should reach the provider in: prefix
 * caching stops at the first differing byte, so the STABLE blocks must lead and the per-call ones follow. Expressing
 * the render order as a table lets the source literal stay in reading order while the wire bytes go slow→fast, and
 * lets a reorder be a one-line table edit rather than a diff nobody can review.
 *
 * Ties are broken by key NAME rather than by input position, so the result is a TOTAL order and therefore invariant
 * under any permutation of the input — two valid compositions of the same block set can never produce different
 * request bytes. (Block keys are unique within one live context, so `(rank, key)` is total.) The key comparison is
 * `localeCompare` without a locale argument.
 *
 * @param blocks - The blocks, in whatever order the capability assembled them.
 * @param order - The sparse key → rank table.
 * @param defaultOrder - The rank a key absent from the table lands at.
 * @returns The blocks in render order (a new array; the input is not mutated).
 *
 * @example
 * ```ts
 * orderLlmLiveContextBlocks(blocks, { heading: 0, identity: 10, history: 50 }, 100);
 * ```
 */
export function orderLlmLiveContextBlocks<T extends Pick<LlmLiveContextBlock, 'key'>>(blocks: ReadonlyArray<T>, order: LlmLiveContextBlockOrder, defaultOrder: number): ReadonlyArray<T> {
  const rankOf = (block: T): number => order[block.key] ?? defaultOrder;
  return blocks.toSorted((a, b) => rankOf(a) - rankOf(b) || a.key.localeCompare(b.key));
}

/**
 * The inputs {@link llmLiveContextRowsBlock} builds one rows block from.
 */
export interface LlmLiveContextRowsBlockConfig {
  /**
   * The block's key ({@link LlmLiveContextBlock.key}).
   */
  readonly key: string;
  /**
   * The block's header line(s); nullish or blank ⇒ the rows alone.
   */
  readonly head?: Maybe<string>;
  /**
   * The block's keyed rows, in render order.
   */
  readonly rows: ReadonlyArray<LlmLiveContextRow>;
  /**
   * WHY the block is present ({@link LlmLiveContextBlock.reason}).
   */
  readonly reason?: string;
  /**
   * The block's stability claim ({@link LlmLiveContextBlock.volatile}).
   */
  readonly volatile?: boolean;
}

/**
 * The text a rows block renders to — `head` then every row, joined by `'\n'`.
 *
 * @param head - The header, when any.
 * @param rows - The rows.
 * @returns The joined text.
 *
 * @example
 * ```ts
 * llmLiveContextRowsText('History', [{ text: 'one' }, { text: 'two' }]); // 'History\none\ntwo'
 * ```
 */
export function llmLiveContextRowsText(head: Maybe<string>, rows: ReadonlyArray<Pick<LlmLiveContextRow, 'text'>>): string {
  return [...(head == null || head === '' ? [] : [head]), ...rows.map((row) => row.text)].join('\n');
}

/**
 * Build one ROWS block — `text` is {@link llmLiveContextRowsText}, and `head` / `rows` ride along so a chained
 * follow-up can re-send only the changed rows. `undefined` when it has no rows (a header alone is not a block).
 *
 * @param config - The key, header, rows and optional reason / stability claim.
 * @returns The block, or `undefined` when it has no rows.
 *
 * @example
 * ```ts
 * llmLiveContextRowsBlock({ key: 'history', head: 'History', rows: [{ key: 'h1', text: 'one' }] });
 * ```
 */
export function llmLiveContextRowsBlock(config: LlmLiveContextRowsBlockConfig): Maybe<LlmLiveContextBlock> {
  const { key, head, rows, reason, volatile } = config;
  const cleanHead = head == null || head.trim() === '' ? undefined : head;
  return rows.length === 0
    ? undefined
    : {
        key,
        text: llmLiveContextRowsText(cleanHead, rows),
        ...(cleanHead == null ? {} : { head: cleanHead }),
        rows,
        ...(reason == null ? {} : { reason }),
        ...(volatile == null ? {} : { volatile })
      };
}

/**
 * The line naming the live-context blocks a chained follow-up did NOT re-send because their bytes match what the
 * thread already holds.
 */
export const LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD = 'Unchanged since the last item (read them above):';

/**
 * The lead of the line a re-sent ROWS block closes with, naming the rows it did not repeat.
 */
export const LLM_CHAINED_FOLLOW_UP_UNCHANGED_ROWS_LEAD = 'Unchanged rows (read them above):';

/**
 * The lead of the line naming rows of a re-sent ROWS block that are gone.
 */
export const LLM_CHAINED_FOLLOW_UP_DROPPED_ROWS_LEAD = 'Rows no longer shown:';

/**
 * The lead of the line naming whole live-context blocks the last item showed and this one does not.
 */
export const LLM_CHAINED_FOLLOW_UP_DROPPED_LEAD = 'No longer shown:';

/**
 * Whether a block's `text` is still exactly its `head` + `rows` — false once something rewrote `text` after the rows
 * were built (a budget shrink), which makes the rows untrustworthy as a diff base.
 *
 * @param block - The block.
 * @returns Whether the rows can be diffed.
 */
function rowsConsistent(block: LlmLiveContextBlock): block is LlmLiveContextBlock & { readonly rows: ReadonlyArray<LlmLiveContextRow> } {
  return block.rows != null && block.text === llmLiveContextRowsText(block.head, block.rows);
}

/**
 * Whether two rows say the same thing — by {@link LlmLiveContextRow.identity} when both carry one, else by text.
 *
 * @param a - One row.
 * @param b - The other.
 * @returns Whether they are equal.
 */
function sameRow(a: LlmLiveContextRow, b: LlmLiveContextRow): boolean {
  return a.identity != null && b.identity != null ? a.identity === b.identity : a.text === b.text;
}

/**
 * The row-level diff of a ROWS block against the block the thread holds under the same key — `undefined` when the
 * two cannot be diffed by row (either is not a consistent rows block, or the headers differ).
 */
interface RowsDelta {
  readonly changed: ReadonlyArray<LlmLiveContextRow>;
  readonly unchangedKeys: ReadonlyArray<string>;
  readonly droppedKeys: ReadonlyArray<string>;
}

/**
 * Diff a rows block against the held block of the same key.
 *
 * @param block - The block being sent.
 * @param held - The block the thread holds under the same key.
 * @returns The delta, or `undefined` when the block must be sent whole.
 */
function rowsDeltaOf(block: LlmLiveContextBlock, held: Maybe<LlmLiveContextBlock>): Maybe<RowsDelta> {
  let delta: Maybe<RowsDelta>;

  if (held != null && rowsConsistent(block) && rowsConsistent(held) && block.head === held.head) {
    const heldRows = new Map(held.rows.map((row) => [row.key, row]));
    const keys = new Set(block.rows.map((row) => row.key));
    const changed: LlmLiveContextRow[] = [];
    const unchangedKeys: string[] = [];

    for (const row of block.rows) {
      const before = heldRows.get(row.key);

      if (before != null && sameRow(before, row)) {
        unchangedKeys.push(row.key);
      } else {
        changed.push(row);
      }
    }

    delta = { changed, unchangedKeys, droppedKeys: held.rows.filter((row) => !keys.has(row.key)).map((row) => row.key) };
  }

  return delta;
}

/**
 * Render a changed rows block as its delta: the header, the new / changed rows, then one line naming the rows not
 * repeated and the rows that are gone.
 *
 * @param block - The block being sent.
 * @param delta - Its row delta.
 * @returns The block's follow-up text.
 */
function rowsDeltaText(block: LlmLiveContextBlock, delta: RowsDelta): string {
  const notes = [delta.unchangedKeys.length === 0 ? undefined : `${LLM_CHAINED_FOLLOW_UP_UNCHANGED_ROWS_LEAD} ${delta.unchangedKeys.join(', ')}.`, delta.droppedKeys.length === 0 ? undefined : `${LLM_CHAINED_FOLLOW_UP_DROPPED_ROWS_LEAD} ${delta.droppedKeys.join(', ')}.`].filter((note): note is string => note != null);
  return [llmLiveContextRowsText(block.head, delta.changed), notes.join(' ')].filter((part) => part.length > 0).join('\n');
}

/**
 * The keys of whole blocks the PREVIOUS item showed that this one does not — empty unless the two renders share a key
 * besides the heading (a render of an entirely different block set must not read as dropping the previous one's
 * blocks).
 *
 * @param blocks - This item's blocks.
 * @param previous - The previous item's own render.
 * @returns The dropped keys, in the previous render's order.
 *
 * @example
 * ```ts
 * droppedLlmLiveContextBlockKeys([{ key: 'heading', text: 'H' }, { key: 'focus', text: 'F' }], previous); // e.g. ['alert']
 * ```
 */
export function droppedLlmLiveContextBlockKeys(blocks: ReadonlyArray<LlmLiveContextBlock>, previous: Maybe<ReadonlyArray<LlmLiveContextBlock>>): ReadonlyArray<string> {
  const keys = new Set(blocks.filter((block) => block.text.length > 0).map((block) => block.key));
  const shared = previous?.some((block) => block.key !== LLM_LIVE_CONTEXT_HEADING_BLOCK_KEY && keys.has(block.key)) ?? false;
  return shared && previous != null ? previous.filter((block) => block.text.length > 0 && !keys.has(block.key)).map((block) => block.key) : [];
}

/**
 * A chained follow-up's live context as a DELTA over what the thread already holds — re-sending a whole re-rendered
 * live context on top of a replayed thread that already holds most of it pays for the same bytes twice.
 *
 * - An unchanged block is only NAMED by its key (one closing line).
 * - A changed ROWS block ({@link llmLiveContextRowsBlock}) whose held twin has the same header re-sends the header,
 *   the new / changed rows and one line naming the unchanged and dropped rows. Rows compare by
 *   {@link LlmLiveContextRow.identity} when both carry one.
 * - Any other changed (or new) block is sent WHOLE, never line-diffed.
 * - A whole block the previous item showed and this one does not is named once ("No longer shown: …"), so a cleared
 *   block does not read as still standing.
 *
 * With nothing unchanged and nothing dropped the body is the whole live context, byte-identical to a full render. No
 * base ⇒ the whole live context.
 *
 * @param blocks - The follow-up's rendered blocks.
 * @param base - The blocks the thread already holds (cumulative along the chain), when known.
 * @param previous - The previous item's OWN render, for the dropped-block line; absent ⇒ none named.
 * @returns The follow-up body (after the lead).
 *
 * @example
 * ```ts
 * llmChainedFollowUpBody([{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], [{ key: 'a', text: 'A' }]);
 * // 'B\n\nUnchanged since the last item (read them above): a.'
 * ```
 */
export function llmChainedFollowUpBody(blocks: ReadonlyArray<LlmLiveContextBlock>, base: Maybe<ReadonlyArray<LlmLiveContextBlock>>, previous?: Maybe<ReadonlyArray<LlmLiveContextBlock>>): string {
  let body: string;

  if (base == null) {
    body = joinLlmLiveContextBlocks(blocks);
  } else {
    const held = new Map(base.map((block) => [block.key, block]));
    const unchangedKeys: string[] = [];
    const sentTexts: string[] = [];

    for (const block of blocks) {
      if (block.text.length > 0) {
        const before = held.get(block.key);
        const delta = before == null || before.text === block.text ? undefined : rowsDeltaOf(block, before);

        if (before?.text === block.text || (delta?.changed.length === 0 && delta.droppedKeys.length === 0)) {
          unchangedKeys.push(block.key);
        } else {
          sentTexts.push(delta == null ? block.text : rowsDeltaText(block, delta));
        }
      }
    }

    const dropped = droppedLlmLiveContextBlockKeys(blocks, previous);
    const named = unchangedKeys.length === 0 ? '' : `${LLM_CHAINED_FOLLOW_UP_UNCHANGED_LEAD} ${unchangedKeys.join(', ')}.`;
    const gone = dropped.length === 0 ? '' : `${LLM_CHAINED_FOLLOW_UP_DROPPED_LEAD} ${dropped.join(', ')}.`;
    body = [...sentTexts, named, gone].filter((part) => part.length > 0).join(LLM_LIVE_CONTEXT_BLOCK_SEPARATOR);
  }

  return body;
}

/**
 * The delta base a chained follow-up leaves for the NEXT one: what the thread now holds, by key — the parent's base
 * (minus blocks this item named as gone), overwritten by this item's blocks. Cumulative, so a render that shares no
 * block with the previous one does not wipe the previous one's blocks from the base.
 *
 * @param base - The parent's base, when known.
 * @param sent - This item's rendered blocks.
 * @param dropped - The keys this item named as no longer shown.
 * @returns The merged base.
 *
 * @example
 * ```ts
 * const nextBase = mergeLlmChainedFollowUpBase(base, sentBlocks, droppedLlmLiveContextBlockKeys(sentBlocks, previous));
 * ```
 */
export function mergeLlmChainedFollowUpBase(base: Maybe<ReadonlyArray<LlmLiveContextBlock>>, sent: ReadonlyArray<LlmLiveContextBlock>, dropped: ReadonlyArray<string> = []): ReadonlyArray<LlmLiveContextBlock> {
  const sentKeys = new Set(sent.map((block) => block.key));
  const gone = new Set(dropped);
  return [...(base ?? []).filter((block) => !sentKeys.has(block.key) && !gone.has(block.key)), ...sent];
}
