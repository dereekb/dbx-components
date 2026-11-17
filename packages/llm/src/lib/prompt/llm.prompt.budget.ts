/**
 * The live-context token BUDGET — a deterministic shrink-then-drop renderer that keeps a capability's live context
 * under a token ceiling (default {@link DEFAULT_LLM_PROMPT_TOKEN_BUDGET}) by first shrinking, then dropping, the
 * LEAST-important blocks (ascending {@link LlmBudgetedBlock.priority}) — never touching a `required` block.
 *
 * Pure and model-free (a `ceil(len / 4)` estimate, no model call), so a trimmed render replays identically. It NEVER
 * blocks a send: when the required blocks alone exceed the budget they are returned whole, and the dispatcher records
 * the over-budget gap and sends anyway.
 *
 * No diag coupling: the budgeter returns its trim report and records nothing. A host that logs what was trimmed folds
 * the report with {@link llmBudgetTrimSummaryOf} and records it its own way.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmThreadTurn } from '../strategy/llm.strategy';
import { joinLlmLiveContextBlocks, LLM_LIVE_CONTEXT_BLOCK_SEPARATOR, type LlmLiveContextBlock } from './llm.prompt.live.context';

/**
 * Estimate the token count of a text — the deterministic `ceil(len / 4)` heuristic (≈ 4 chars per token). Cheap,
 * model-free and monotone in length, so it is a stable trimming and telemetry signal, never an exact count.
 *
 * The divisor is correct and deliberately unchanged; an estimate that misses the bill misses it because of its
 * SUBJECT (what was counted), not the divisor — see {@link estimateLlmRequestPromptTokens}.
 *
 * @param text - The text to estimate.
 * @returns The estimated token count.
 *
 * @example
 * ```ts
 * estimateLlmTokens('abcde'); // 2
 * ```
 */
export function estimateLlmTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * The per-message overhead a chat API adds around every message (the role wrapper and separators). Small, flat and
 * provider-shaped — here so a threaded estimate is not systematically one message short, never as a precision claim.
 */
export const LLM_ESTIMATE_MESSAGE_ENVELOPE_TOKENS = 4;

/**
 * ONE request's billable prompt, as the provider will count it.
 */
export interface LlmRequestPromptTokenEstimateInput {
  /**
   * The NEW user message — the request's assembled prompt.
   */
  readonly prompt: string;
  /**
   * The prior turns replayed ahead of it. A chained follow-up re-sends the whole conversation, so an estimate over the
   * new message alone is not an approximation of the bill — it is a different quantity.
   */
  readonly thread?: Maybe<ReadonlyArray<Pick<LlmThreadTurn, 'content'>>>;
  /**
   * The response-format payload (the request's `responseSchemaHint`), which is SENT and BILLED but lives outside
   * {@link prompt}. A schema costs a constant per shape rather than a proportion of the prompt.
   */
  readonly responseSchemaHint?: unknown;
}

/**
 * Estimate what the PROVIDER will bill for one request — the whole of it, not just the assembled prompt string.
 *
 * {@link estimateLlmTokens} is correct and deliberately unchanged: the divisor was never the problem. What an estimate
 * over the prompt alone gets wrong is the SUBJECT — the bill covers the replayed thread and the schema sent as the
 * response format too. Still `ceil(len / 4)` throughout, still pure, still model-free.
 *
 * @param input - The request's prompt, replayed thread and response-schema payload.
 * @returns The estimated billed prompt tokens.
 *
 * @example
 * ```ts
 * estimateLlmRequestPromptTokens({ prompt: 'say one line' }); // 7 — 3 for the text, 4 for its envelope
 * ```
 */
export function estimateLlmRequestPromptTokens(input: LlmRequestPromptTokenEstimateInput): number {
  const thread = input.thread ?? [];
  const schema = input.responseSchemaHint == null ? 0 : estimateLlmTokens(JSON.stringify(input.responseSchemaHint));
  const replayed = thread.reduce((total, turn) => total + estimateLlmTokens(turn.content) + LLM_ESTIMATE_MESSAGE_ENVELOPE_TOKENS, 0);
  return estimateLlmTokens(input.prompt) + LLM_ESTIMATE_MESSAGE_ENVELOPE_TOKENS + replayed + schema;
}

/**
 * The default live-context token budget.
 */
export const DEFAULT_LLM_PROMPT_TOKEN_BUDGET = 12_000;

/**
 * The tokens a host reserves for the STATIC prompt prefix and the response schema beside it when it budgets the live
 * context against a whole-prompt ceiling of the same number — at the default budget, 12,000 − 2,000 leaves the live
 * context 10,000. Pass it as {@link BudgetLlmLiveContextBlocksConfig.reservedPrefixTokens}; the budgeter's own default
 * reserve is `0`.
 */
export const LLM_PROMPT_PREFIX_RESERVE_TOKENS = 2_000;

/**
 * One priority-ranked block of a live context. Blocks render in ARRAY order; when the budget is exceeded they are
 * shrunk, then dropped, in ASCENDING {@link priority} (lowest first = least important).
 */
export interface LlmBudgetedBlock {
  /**
   * The block's full rendered text, without a separator.
   */
  readonly text: string;
  /**
   * The trim priority — LOWER is trimmed FIRST. Blocks of equal priority trim in array order.
   */
  readonly priority: number;
  /**
   * Pre-rendered, progressively smaller variants (largest → smallest), tried in order before the block is dropped.
   * Omitted ⇒ the block can only be dropped, never shrunk.
   */
  readonly shrink?: ReadonlyArray<string>;
  /**
   * When `true` the block is NEVER trimmed (the material the capability cannot function without).
   */
  readonly required?: boolean;
  /**
   * The block's live-context key ({@link LlmLiveContextBlock.key}); omitted ⇒ `block-<index>` (its render position).
   */
  readonly key?: string;
  /**
   * WHY the block is present ({@link LlmLiveContextBlock.reason}); a shrunk block's reason names the shrink instead.
   */
  readonly reason?: string;
  /**
   * Whether the block's bytes move call-to-call ({@link LlmLiveContextBlock.volatile}, absent ⇒ volatile) — carried
   * through to the survivors so a budgeted live context still declares its cache boundary. Trimming never reads it:
   * what a block COSTS and how OFTEN it changes are different questions.
   */
  readonly volatile?: boolean;
}

/**
 * Config for {@link budgetLlmLiveContextBlocks}.
 */
export interface BudgetLlmLiveContextBlocksConfig {
  /**
   * The blocks, in render order.
   */
  readonly blocks: ReadonlyArray<LlmBudgetedBlock>;
  /**
   * The token ceiling for the joined live context PLUS {@link reservedPrefixTokens}; nullish ⇒
   * {@link DEFAULT_LLM_PROMPT_TOKEN_BUDGET}.
   */
  readonly budget?: Maybe<number>;
  /**
   * The estimated tokens the static prefix already consumes — reserved against the budget so the live context fits
   * under the whole-prompt ceiling ({@link LLM_PROMPT_PREFIX_RESERVE_TOKENS}); nullish ⇒ `0`.
   */
  readonly reservedPrefixTokens?: Maybe<number>;
}

/**
 * One trim action {@link budgetLlmLiveContextBlocks} took.
 */
export interface LlmBudgetTrimReport {
  /**
   * The priority of the trimmed block.
   */
  readonly priority: number;
  /**
   * Whether the block was shrunk to a smaller variant or dropped entirely.
   */
  readonly action: 'shrunk' | 'dropped';
  /**
   * The estimated tokens the action saved.
   */
  readonly savedTokens: number;
}

/**
 * The result of {@link budgetLlmLiveContextBlocks}.
 */
export interface LlmBudgetedLiveContext {
  /**
   * The SURVIVING blocks in render order, dropped and empty ones removed. A shrunk block carries its CURRENT variant
   * text and a reason naming the shrink, so a prompt inspector shows what was actually sent.
   */
  readonly blocks: ReadonlyArray<LlmLiveContextBlock>;
  /**
   * The survivors joined to bytes — `joinLlmLiveContextBlocks(blocks)`, carried beside them so a caller that wants
   * the whole live context as one string cannot join it differently.
   */
  readonly liveContext: string;
  /**
   * The trim actions taken; empty when everything fit.
   */
  readonly trimmed: ReadonlyArray<LlmBudgetTrimReport>;
}

/**
 * One block's mutable render state during trimming.
 */
interface WorkingBlock {
  readonly block: LlmBudgetedBlock;
  variantIndex: number;
  dropped: boolean;
}

/**
 * The variant chain of a block — `[text, ...shrink]`, largest → smallest.
 *
 * @param block - The block.
 * @returns The ordered variant texts.
 */
function blockVariants(block: LlmBudgetedBlock): ReadonlyArray<string> {
  return [block.text, ...(block.shrink ?? [])];
}

/**
 * The current rendered text of a working block (empty when dropped).
 *
 * @param working - The working block.
 * @returns The current text.
 */
function currentText(working: WorkingBlock): string {
  return working.dropped ? '' : blockVariants(working.block)[working.variantIndex];
}

/**
 * Budget a live context and return the SURVIVING keyed blocks — a deterministic shrink-then-drop of the
 * least-important blocks, never trimming a `required` block, never blocking a send.
 *
 * Over budget ⇔ `reservedPrefixTokens + estimateLlmTokens(joined survivors) > budget`. Phase 1 walks each trimmable
 * block (ascending priority, stable by index) down its shrink variants while over budget; phase 2 drops whole blocks
 * in the same order while still over. A block with no {@link LlmBudgetedBlock.key} is keyed `block-<index>` by its
 * render position. Rows and a head are not carried, so a chained follow-up diffs a budgeted block whole.
 *
 * @param config - The blocks, the budget and the reserved prefix tokens.
 * @returns The surviving blocks, their joined bytes and the trim report.
 *
 * @example
 * ```ts
 * const budgeted = budgetLlmLiveContextBlocks({
 *   blocks: [
 *     { key: 'heading', text: '## Live context', priority: 9, required: true, volatile: false },
 *     { key: 'history', text: historyText, priority: 1, shrink: [recentHistoryText] }
 *   ],
 *   reservedPrefixTokens: LLM_PROMPT_PREFIX_RESERVE_TOKENS
 * });
 * const request = { capability: 'summarize', renderLiveContext: () => budgeted.blocks };
 * ```
 */
export function budgetLlmLiveContextBlocks(config: BudgetLlmLiveContextBlocksConfig): LlmBudgetedLiveContext {
  const budget = config.budget ?? DEFAULT_LLM_PROMPT_TOKEN_BUDGET;
  const reserved = config.reservedPrefixTokens ?? 0;
  const working: ReadonlyArray<WorkingBlock> = config.blocks.map((block) => ({ block, variantIndex: 0, dropped: false }));
  const trimmed: LlmBudgetTrimReport[] = [];

  const join = (): string =>
    working
      .map(currentText)
      .filter((text) => text.length > 0)
      .join(LLM_LIVE_CONTEXT_BLOCK_SEPARATOR);
  const overBudget = (): boolean => reserved + estimateLlmTokens(join()) > budget;

  // The trim order — ascending priority (least important first), stable by array index; `required` blocks are
  // excluded entirely so they are never shrunk or dropped.
  const trimOrder = working
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => w.block.required !== true)
    .sort((a, b) => a.w.block.priority - b.w.block.priority || a.index - b.index)
    .map(({ w }) => w);

  // Phase 1 — SHRINK: walk each trimmable block down its variant chain until it fits (or bottoms out), one report per
  // block that moved.
  for (const w of trimOrder) {
    if (!overBudget()) {
      break;
    }

    const variants = blockVariants(w.block);
    const before = estimateLlmTokens(currentText(w));

    while (overBudget() && w.variantIndex < variants.length - 1) {
      w.variantIndex += 1;
    }

    const saved = before - estimateLlmTokens(currentText(w));

    if (saved > 0) {
      trimmed.push({ priority: w.block.priority, action: 'shrunk', savedTokens: saved });
    }
  }

  // Phase 2 — DROP: still over ⇒ drop the least-important remaining blocks entirely.
  for (const w of trimOrder) {
    if (!overBudget()) {
      break;
    }

    if (!w.dropped) {
      const before = estimateLlmTokens(currentText(w));
      w.dropped = true;
      trimmed.push({ priority: w.block.priority, action: 'dropped', savedTokens: before });
    }
  }

  // Project the settled state back to keyed blocks: dropped / empty ones are removed (an interior empty block would
  // inject a stray blank line into the join), and a SHRUNK one carries its current variant plus a reason naming the
  // shrink.
  const survivors: ReadonlyArray<LlmLiveContextBlock> = working
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => currentText(w).length > 0)
    .map(({ w, index }) => {
      const shrunk = w.variantIndex > 0;
      const reason = shrunk ? `shrunk to variant ${w.variantIndex} under the ${budget}-token live-context budget` : w.block.reason;
      return { key: w.block.key ?? `block-${index}`, text: currentText(w), ...(reason == null ? {} : { reason }), ...(w.block.volatile == null ? {} : { volatile: w.block.volatile }) };
    });

  return { blocks: survivors, liveContext: joinLlmLiveContextBlocks(survivors), trimmed };
}

/**
 * A trim report folded to counts — what a host records about one budgeted render.
 */
export interface LlmBudgetTrimSummary {
  /**
   * How many blocks were trimmed (shrunk or dropped); `0` ⇒ nothing to record.
   */
  readonly blocks: number;
  /**
   * How many were dropped.
   */
  readonly dropped: number;
  /**
   * How many were shrunk.
   */
  readonly shrunk: number;
  /**
   * The estimated tokens every action saved, summed.
   */
  readonly savedTokens: number;
}

/**
 * Fold a trim report to counts — the pure half of a host's "live context trimmed" breadcrumb. An empty report sums to
 * zeros (a host records nothing when `blocks === 0`).
 *
 * @param trimmed - The trim report of one {@link budgetLlmLiveContextBlocks} call.
 * @returns The folded counts.
 *
 * @example
 * ```ts
 * const summary = llmBudgetTrimSummaryOf(budgeted.trimmed);
 * if (summary.blocks > 0) log.debug('live context trimmed', summary);
 * ```
 */
export function llmBudgetTrimSummaryOf(trimmed: ReadonlyArray<LlmBudgetTrimReport>): LlmBudgetTrimSummary {
  const dropped = trimmed.filter((report) => report.action === 'dropped').length;
  const savedTokens = trimmed.reduce((total, report) => total + report.savedTokens, 0);
  return { blocks: trimmed.length, dropped, shrunk: trimmed.length - dropped, savedTokens };
}
