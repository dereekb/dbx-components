/**
 * Token usage and provider cost for one LLM call, and **the ONE place a provider's raw usage block becomes
 * {@link LlmUsage}**.
 *
 * Every transport reports what a call cost in the same snake_case OpenAI-derived shape. Normalizing it with a
 * hand-copied conditional-spread block per transport is one chance per copy to get the ABSENCE semantics wrong, and
 * getting them wrong is silent: a `cost` key spread as `undefined` rather than omitted reads to a ledger as a
 * reported cost of nothing, the exact opposite of "this call's cost is unknown".
 *
 * So the rule this module holds, and the reason every field below is a conditional spread rather than a nullish
 * default:
 *
 * - the three TOKEN counts are always present, defaulting to `0` — a provider that answered billed something, and a
 *   zero is a reading;
 * - every OTHER field is OMITTED when the provider did not report it — never `undefined`, never `0`. A bare
 *   OpenAI-compatible endpoint returns no `cost`, and a ledger counts that call as cost-UNKNOWN rather than free. An
 *   aggregator that volunteers one gets a real dollar figure.
 *
 * Some providers return `usage.cost` synchronously but as the pre-discount LIST amount rather than the bill (ZenMux
 * does); a transport that knows its provider meters that way passes `costBasis: 'list'` here and the figure is
 * stamped as an upper bound ({@link LlmCostBasis}) rather than read as a measurement.
 *
 * The two COST fields are also where a wire type lies: some OpenAI-compatible gateways send `usage.cost` as a numeric
 * STRING (`"cost":"0.00065716"`). Passed through, every downstream `total + cost` concatenates instead of adding and
 * the first `cost.toFixed` throws. So both cost fields go through {@link llmCostOf} here, at the point they enter,
 * and anything that is not a finite number stays ABSENT under the same rule as above.
 *
 * Absence is spelt `| undefined`, not `Maybe`: one spelling keeps a conditional spread of the result byte-stable.
 */

import { type DollarAmount, type Maybe } from '@dereekb/util';

/**
 * The provider cost breakdown (`usage.cost_details`) — the meaningful sub-fields OpenRouter returns alongside the
 * flat {@link LlmUsage.cost}, captured as a typed optional (not the whole raw blob). Present only when the provider
 * returned it; omitted otherwise (byte-stable absence).
 */
export interface LlmCostDetails {
  /**
   * The upstream provider's inference cost (OpenRouter's `cost_details.upstream_inference_cost`) — the raw model
   * cost before OpenRouter's own accounting. Present only when the provider reported it.
   */
  readonly upstreamInferenceCost?: DollarAmount;
}

/**
 * WHAT a provider's synchronous {@link LlmUsage.cost} figure is, when it is not the bill.
 *
 * `'list'` — the provider's pre-discount LIST (origin) amount. ZenMux returns one on every completion, and on a
 * discounted slug the bill is lower (some slugs bill exactly the list figure, others exactly half of it). A list
 * figure is therefore an UPPER bound on what the call billed, never a measurement of it. The bill itself is
 * retrospective (read later through an `LlmCallBillReader`).
 */
export type LlmCostBasis = 'list';

/**
 * Token usage (plus the optional provider dollar cost) for one LLM call — the cost-attribution telemetry. Read from
 * the provider completion's `usage` block (an OpenRouter transport sets `usage:{include:true}` on the request so
 * `cost` rides through). Counts are always present when a real completion was read; `cost` only when the provider
 * returned it. Absent entirely on a strategy with no provider completion to read (a scripted or tape strategy).
 */
export interface LlmUsage {
  /**
   * Prompt (input) tokens billed for this call.
   */
  readonly promptTokens: number;
  /**
   * Completion (output) tokens billed for this call.
   */
  readonly completionTokens: number;
  /**
   * Total tokens billed (prompt + completion), as the provider reports it.
   */
  readonly totalTokens: number;
  /**
   * Provider-reported cost (OpenRouter credits/USD; ZenMux's list amount). Present only when the provider returned a
   * `cost`; omitted otherwise. What the figure IS rides {@link costBasis}.
   */
  readonly cost?: DollarAmount;
  /**
   * What {@link cost} is when it is not the bill ({@link LlmCostBasis}) — `'list'` on a provider whose synchronous
   * figure is its pre-discount list price, stamped by the transport from the provider's declared metering. ABSENT ⇒
   * the figure is the bill. Never present without a {@link cost}.
   */
  readonly costBasis?: LlmCostBasis;
  /**
   * Prompt tokens the provider served from a warm prompt cache (`usage.prompt_tokens_details.cached_tokens`) — a
   * subset of {@link promptTokens}. The cache-HIT observability signal: a high `cachedTokens / promptTokens` ratio
   * means the stable preamble is being reused (cheap), a low one means every call re-billed the prefix. Present only
   * when the provider reported it; omitted otherwise (byte-stable absence).
   */
  readonly cachedTokens?: number;
  /**
   * Prompt tokens the provider WROTE into its cache on this call (`prompt_tokens_details.cache_write_tokens`,
   * OpenRouter-normalized) — the cache-population cost signal, billed at a premium by explicit-caching providers
   * (e.g. Anthropic 1.25×). Implicit-caching providers (DeepSeek, OpenAI) do not report it. Present only when the
   * provider reported it; omitted otherwise (byte-stable absence).
   */
  readonly cacheWriteTokens?: number;
  /**
   * Hidden REASONING tokens the provider billed as part of {@link completionTokens} on a hybrid-reasoning model
   * (`completion_tokens_details.reasoning_tokens`). Reasoning can be most of a call's billed completion tokens while
   * staying invisible in the reply, so surfacing it is what lets a report see which calls paid for reasoning.
   * Present only when the provider reported it; omitted otherwise (byte-stable absence — a non-reasoning call
   * carries none).
   */
  readonly reasoningTokens?: number;
  /**
   * The prompt tokens the provider says the attached PICTURES cost (`prompt_tokens_details.image_tokens`), a subset
   * of {@link promptTokens}. Only some models report it. When present it is the strongest proof a picture arrived at
   * the model. Present only when the provider reported it; omitted otherwise (byte-stable absence; a text call
   * carries none).
   */
  readonly imageTokens?: number;
  /**
   * The provider cost breakdown ({@link LlmCostDetails}), when the provider returned `usage.cost_details`. Omitted
   * otherwise. Read alongside the flat {@link cost}.
   */
  readonly costDetails?: LlmCostDetails;
}

/**
 * A provider's raw usage block as it comes off the wire — the union of every field any supported transport reports,
 * all optional, because every one of them is absent somewhere.
 *
 * Modeled locally rather than imported from a vendor SDK: this is the set of keys we READ, and pinning it here means
 * a vendor widening its own type cannot silently change what we fold.
 */
export interface RawLlmUsage {
  readonly prompt_tokens?: Maybe<number>;
  readonly completion_tokens?: Maybe<number>;
  readonly total_tokens?: Maybe<number>;
  readonly prompt_tokens_details?: Maybe<{ readonly cached_tokens?: Maybe<number>; readonly cache_write_tokens?: Maybe<number>; readonly image_tokens?: Maybe<number> }>;
  readonly completion_tokens_details?: Maybe<{ readonly reasoning_tokens?: Maybe<number> }>;
  /**
   * A number on a well-behaved gateway; a numeric string on some OpenAI-compatible ones — {@link llmCostOf} folds
   * both.
   */
  readonly cost?: Maybe<number | string>;
  readonly cost_details?: Maybe<{ readonly upstream_inference_cost?: Maybe<number | string> }>;
}

/**
 * **Read one cost field as a finite dollar figure, or report it absent.**.
 *
 * A finite number passes; a numeric string (the shape some gateways put on the wire, and so the shape older logs
 * already hold) is parsed; anything else — absent, blank, `NaN`, `Infinity`, a non-numeric string, an object — is
 * `undefined`, NEVER `0`. A made-up zero is exactly what makes a cost-less call read as free, so an unreadable cost
 * is spelt the same way as an unreported one.
 *
 * Exported because the READ side needs the same rule: a ledger that re-folds logged calls meets the string shape in
 * records written before the fold existed.
 *
 * @param value - The raw cost value off the wire or out of a logged record.
 * @returns The cost as a finite number, or `undefined` when it is missing or not a number.
 */
export function llmCostOf(value: unknown): DollarAmount | undefined {
  let cost: DollarAmount | undefined;

  if (typeof value === 'number') {
    cost = Number.isFinite(value) ? value : undefined;
  } else if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    cost = Number.isFinite(parsed) ? parsed : undefined;
  }

  return cost;
}

/**
 * The options {@link llmUsageFrom} reads beside the raw block — what the TRANSPORT knows about its provider that the
 * wire does not say.
 */
export interface LlmUsageFromOptions {
  /**
   * What the provider's synchronous `cost` figure is when it is not the bill ({@link LlmCostBasis}). Stamped onto the
   * usage only when a cost is actually present: a basis with no figure would describe nothing.
   */
  readonly costBasis?: Maybe<LlmCostBasis>;
}

/**
 * **Fold one provider's raw usage block into {@link LlmUsage}.**.
 *
 * @param raw - The provider's usage block, or absent when the reply carried none.
 * @param options - What the transport knows about its provider's cost figure.
 * @returns The usage, or `undefined` when the provider reported none — the absence a ledger reads as "this call was
 *   never accounted", which is not the same as a call that cost zero. Never `null`: the absence is spelt ONE way so a
 *   conditional spread of it stays byte-stable.
 */
export function llmUsageFrom(raw: Maybe<RawLlmUsage>, options?: LlmUsageFromOptions): LlmUsage | undefined {
  const cachedTokens = raw?.prompt_tokens_details?.cached_tokens;
  const cacheWriteTokens = raw?.prompt_tokens_details?.cache_write_tokens;
  const reasoningTokens = raw?.completion_tokens_details?.reasoning_tokens;
  const imageTokens = raw?.prompt_tokens_details?.image_tokens;
  const cost = llmCostOf(raw?.cost);
  const costBasis = cost == null ? undefined : (options?.costBasis ?? undefined);
  const upstreamInferenceCost = llmCostOf(raw?.cost_details?.upstream_inference_cost);

  return raw == null
    ? undefined
    : {
        promptTokens: raw.prompt_tokens ?? 0,
        completionTokens: raw.completion_tokens ?? 0,
        totalTokens: raw.total_tokens ?? 0,
        ...(cachedTokens == null ? {} : { cachedTokens }),
        ...(cacheWriteTokens == null ? {} : { cacheWriteTokens }),
        ...(reasoningTokens == null ? {} : { reasoningTokens }),
        ...(imageTokens == null ? {} : { imageTokens }),
        ...(cost == null ? {} : { cost }),
        ...(costBasis == null ? {} : { costBasis }),
        ...(upstreamInferenceCost == null ? {} : { costDetails: { upstreamInferenceCost } })
      };
}
