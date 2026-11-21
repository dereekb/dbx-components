/**
 * **Cost honesty**: render a summed cost so a hole never reads as free and a list price never reads as a bill.
 *
 * A summed cost is a measurement only when every counted call priced itself from the bill. When some call reported no
 * cost, the sum is a LOWER bound (`>=`); when some call's cost is the provider's LIST price, it is an UPPER bound on the
 * bill (`<=`); when both hold, neither bound holds (`~`); and when no call priced itself at all, the figure is UNKNOWN
 * (`n/a`). These helpers make that ONE decision for every surface that prints a cost.
 */

import { asFiniteNumber, type DollarAmount, type Maybe, type Count } from '@dereekb/util';

/**
 * The cell every surface renders when a slice's dollar figure is UNKNOWN — the provider reported no cost at all — as
 * distinct from a measured zero. `$0.0000` reads as "this run was free"; this reads as "nobody said".
 */
export const LLM_USAGE_COST_UNAVAILABLE_CELL = 'n/a';

/**
 * The three facts that decide whether a summed cost is a measurement or a hole.
 */
export interface LlmUsageCostRead {
  /**
   * The summed provider cost over the slice (`LlmUsageCell.cost`).
   */
  readonly cost: DollarAmount;
  /**
   * The calls the sum is over (`LlmUsageCell.calls`) — a zero-call slice is free, not unknown.
   */
  readonly calls: Count;
  /**
   * The enclosing fold's `costPartial` flag — >=1 counted call reported no provider cost.
   */
  readonly partial: boolean;
  /**
   * The enclosing fold's `costListed` flag — >=1 counted call's cost is the provider's LIST price
   * (`LlmUsage.costBasis: 'list'`), so the sum is an UPPER bound on the bill. Absent ⇒ none was.
   */
  readonly listed?: boolean;
}

/**
 * Is this slice's dollar figure UNKNOWN rather than measured-zero? True only when at least one call was counted, at
 * least one reported no cost, and NONE reported any — i.e. the sum is a hole, not a total. A tape replay (cost forced
 * to 0, `partial` false) and a genuinely free model both stay measured zeros.
 *
 * @param read - The slice's cost / calls / partial facts.
 * @returns Whether the slice's cost is unavailable rather than zero.
 *
 * @example
 * ```ts
 * isLlmUsageCostUnavailable({ cost: 0, calls: 2, partial: true }); // true
 * isLlmUsageCostUnavailable({ cost: 0, calls: 0, partial: true }); // false — an empty slice is exactly free
 * ```
 */
export function isLlmUsageCostUnavailable(read: LlmUsageCostRead): boolean {
  return read.partial && read.cost === 0 && read.calls > 0;
}

/**
 * The prefixes a summed cost takes when it is a BOUND rather than a measurement.
 */
export interface LlmUsageCostMarkers {
  /**
   * Prefixed when >=1 call reported no cost ({@link LlmUsageCostRead.partial}): the sum is a LOWER bound. Defaults to
   * `>=`.
   */
  readonly lower?: string | undefined;
  /**
   * Prefixed when >=1 call's cost is a LIST price ({@link LlmUsageCostRead.listed}): the sum is an UPPER bound on the
   * bill. Defaults to `<=`.
   */
  readonly upper?: string | undefined;
  /**
   * Prefixed when BOTH hold — some calls are missing and some are list-priced, so neither bound holds. Defaults to `~`.
   */
  readonly approximate?: string;
}

/**
 * The honesty prefix for a summed cost — `''` when the sum is a measurement, else the lower / upper / approximate
 * marker. The ONE decision every cost surface shares (a ledger's markdown, a run footer, a run summary), so a
 * list-priced figure cannot read as a bill on one surface and as a bound on another.
 *
 * A ZERO-CALL slice takes no marker: the sum over an empty set is EXACTLY 0.
 *
 * @param read - The slice's calls and its partial / listed facts.
 * @param markers - The marker spellings (ASCII by default; a terminal surface may pass `≥` / `≤`).
 * @returns The prefix, or `''`.
 *
 * @example
 * ```ts
 * resolveLlmUsageCostMarker({ calls: 3, partial: false, listed: true }); // '<='
 * resolveLlmUsageCostMarker({ calls: 3, partial: true }, { lower: '≥' }); // '≥'
 * ```
 */
export function resolveLlmUsageCostMarker(read: Pick<LlmUsageCostRead, 'calls' | 'partial' | 'listed'>, markers?: Maybe<LlmUsageCostMarkers>): string {
  const partial = read.partial && read.calls > 0;
  const listed = read.listed === true && read.calls > 0;
  let marker = '';

  if (partial && listed) {
    marker = markers?.approximate ?? '~';
  } else if (partial) {
    marker = markers?.lower ?? '>=';
  } else if (listed) {
    marker = markers?.upper ?? '<=';
  }

  return marker;
}

/**
 * Config for {@link formatLlmUsageCost}: the cost read plus its rendering knobs.
 */
export interface FormatLlmUsageCostConfig extends LlmUsageCostRead {
  /**
   * Decimal places on the dollar figure; defaults to 6 (a ledger's precision).
   */
  readonly digits?: number;
  /**
   * The lower-bound marker prefixed onto a PARTIAL non-zero cost; defaults to `>=`.
   */
  readonly boundMarker?: string;
  /**
   * The upper-bound marker prefixed onto a LISTED cost; defaults to `<=`.
   */
  readonly listedMarker?: string;
}

/**
 * Render a summed cost with its honesty marker — `n/a` when unknown, `>=$x` when a lower bound, `<=$x` when an upper
 * bound (list-priced), `~$x` when both, `$x` when measured. The ONE place the cases are decided (through
 * {@link resolveLlmUsageCostMarker}), so a reporting surface cannot render a hole as free or a list price as a bill.
 *
 * A ZERO-CALL slice takes no marker: the sum over an empty set is EXACTLY 0, so it is neither unknown nor a bound even
 * when the enclosing slice's {@link LlmUsageCostRead.partial} is set (that flag describes the run, not this row). This
 * is what keeps a never-called capability's honest `$0.000000` from picking up a `>=` that implies its true cost might
 * be higher — with no calls, it cannot be.
 *
 * @param config - The cost read plus its rendering knobs.
 * @returns The rendered cost cell.
 *
 * @example
 * ```ts
 * formatLlmUsageCost({ cost: 0.0123, calls: 3, partial: true }); // '>=$0.012300'
 * formatLlmUsageCost({ cost: 0.03, calls: 2, partial: false, listed: true, digits: 4, listedMarker: '≤' }); // '≤$0.0300'
 * ```
 */
export function formatLlmUsageCost(config: FormatLlmUsageCostConfig): string {
  const digits = config.digits ?? 6;
  const marker = resolveLlmUsageCostMarker(config, { lower: config.boundMarker, upper: config.listedMarker });
  let rendered: string;

  if (isLlmUsageCostUnavailable(config)) {
    rendered = LLM_USAGE_COST_UNAVAILABLE_CELL;
  } else {
    // Coerced, never trusted: a cost folded from a logged row can still be a string, and a render must never throw on
    // one. An unreadable figure renders as the unavailable cell rather than as a made-up number.
    const cost = asFiniteNumber(config.cost);
    rendered = cost == null ? LLM_USAGE_COST_UNAVAILABLE_CELL : `${marker}$${cost.toFixed(digits)}`;
  }

  return rendered;
}

/**
 * The two cost honesty flags a usage slice carries, in the shape {@link formatLlmUsageCost} reads.
 */
export type LlmUsageCostFlags = Pick<LlmUsageCostRead, 'partial' | 'listed'>;

/**
 * Read an aggregate's cost honesty flags as {@link LlmUsageCostFlags} — the one projection every render passes along,
 * so the listed flag cannot be threaded on one table and dropped on the next.
 *
 * @param usage - The aggregate.
 * @param usage.costPartial - Whether >=1 counted call reported no cost.
 * @param usage.costListed - Whether >=1 counted call's cost is a list price.
 * @returns The flags; `listed` is present only when set.
 *
 * @example
 * ```ts
 * formatLlmUsageCost({ cost: total.cost, calls: total.calls, ...readLlmUsageCostFlags(fold) });
 * ```
 */
export function readLlmUsageCostFlags(usage: { readonly costPartial: boolean; readonly costListed?: boolean }): LlmUsageCostFlags {
  return { partial: usage.costPartial, ...(usage.costListed === true ? { listed: true } : {}) };
}
