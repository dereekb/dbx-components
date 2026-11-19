/**
 * The PROVIDER-NEUTRAL account-status contract — "how much of what we are entitled to have we already spent?" — and
 * the third optional, deliberately-networked seam on `LlmStrategy`, beside `healthCheck` (network-free
 * constructibility) and `credentialProbe` (is the key still live).
 *
 * **Named after the failure it exists for.** A spent subscription quota surfaces only as a `402` on the next call.
 * Nothing else in the stack can say otherwise: per-call cost says what one call cost, not what is left of a window
 * (and a provider's synchronous `cost` may be its LIST price, an upper bound on the bill), and neither `402` nor
 * `429` carries a remaining-quota or `retry-after` field. The provider knows; this seam asks.
 *
 * **Why a neutral shape rather than a provider call at each site.** The callers that need to ask — a billed test
 * lane's setup, a batch launch gate — are the same callers that should NOT know which provider is configured (the
 * host decides that at bootstrap). Reaching for one provider's URL inside them would hard-wire today's gateway into
 * the layer built to outlive it. So: the vocabulary lives here (rolling WINDOWS + an optional prepaid BALANCE, both
 * of which a provider either meters or does not), the provider-specific mapping lives in an
 * {@link LlmProviderStatusSource} implementation, and the transport merely delegates to whichever source its host
 * injected.
 *
 * The shape is deliberately all-optional below `providerId` / `available`. Providers disagree about almost
 * everything here: OpenRouter meters a prepaid balance and no window, ZenMux meters two rolling windows in a
 * synthetic unit (Flows) with a floating USD rate, bare OpenAI exposes neither to an inference key. A consumer asks
 * {@link tightestLlmQuotaWindow} for the throttle signal and renders whatever else is present.
 */

import { type DollarAmount, type ISO8601DateString, type PercentDecimal, roundToPrecision, type SuggestedString } from '@dereekb/util';
import { type LlmStrategyHealthIssue } from './llm.strategy.health';

/**
 * The id of the ACCOUNT-METERING provider an {@link LlmProviderStatus} came from — `'zenmux'`, `'openrouter'`.
 *
 * Deliberately NOT an `LlmStrategyId`: the metering provider and the transport are different axes. One `openai`
 * transport reaches ZenMux, a self-hosted router, or bare OpenAI — three different (or absent) metering providers
 * behind one strategy id — so collapsing them would make the report unable to say WHO answered. Display +
 * attribution only; never a parsing contract.
 */
export type LlmProviderStatusProviderId = string;

/**
 * The quota units the library's own adapters report. `'flow'` is ZenMux's synthetic composite unit (tokens + request
 * overhead, at a floating USD rate); a provider that meters raw requests or tokens says so.
 */
export type LlmKnownQuotaUnit = 'flow' | 'request' | 'token' | 'usd';

/**
 * The unit an {@link LlmQuotaWindow} meters in — one of the {@link LlmKnownQuotaUnit}s, or a host's own unit for a
 * provider it meters itself (a TTS vendor's synthesized-character allowance is the host's `'character'`). Open, with
 * the known units kept for autocomplete; the report prints the unit as written.
 */
export type LlmQuotaUnit = SuggestedString<LlmKnownQuotaUnit>;

/**
 * ONE metered consumption window — the unit of the self-throttle decision.
 *
 * Every quantity below {@link id} / {@link label} is optional because providers report wildly different subsets,
 * and a window that carries ONLY {@link usedFraction} is still fully useful to a gate. What a window must never
 * do is synthesize a missing field: an absent {@link resetsAt} means "the provider did not say when this
 * refreshes", which is different from "it refreshes now", and a gate that guessed would happily wait out a
 * window that never resets.
 */
export interface LlmQuotaWindow {
  /**
   * A stable, machine-comparable id for the window — `'rolling-5h'`, `'rolling-7d'`, `'monthly'`. Stable across
   * reads so a caller can single one out; provider-specific values are allowed.
   */
  readonly id: string;
  /**
   * The human label for a report line — `'rolling 5 hours'`.
   */
  readonly label: string;
  /**
   * The fraction of the window already consumed, `0`–`1`. THE throttle signal: it is the one field comparable
   * across providers and units, and the only one {@link tightestLlmQuotaWindow} orders on. Absent when the provider
   * reported a used/max pair this module could not turn into a ratio (a zero or missing maximum).
   */
  readonly usedFraction?: PercentDecimal;
  /**
   * Units consumed in the window so far, in {@link unit}.
   */
  readonly usedUnits?: number;
  /**
   * The window's ceiling, in {@link unit}.
   */
  readonly maxUnits?: number;
  /**
   * Units still available — carried as the provider reported it rather than derived, so a provider that applies
   * its own rounding / holdback is quoted rather than second-guessed.
   */
  readonly remainingUnits?: number;
  /**
   * What {@link usedUnits} / {@link maxUnits} / {@link remainingUnits} are counted in.
   */
  readonly unit?: LlmQuotaUnit;
  /**
   * The USD value of {@link usedUnits}, when the provider prices its unit. For a synthetic unit whose rate
   * floats (a ZenMux Flow) this is the provider's own conversion at read time, NOT a fixed rate — informative
   * for a human, never a basis for arithmetic across two reads.
   */
  readonly usedUsd?: DollarAmount;
  /**
   * The USD value of {@link maxUnits}, on the same floating-rate caveat as {@link usedUsd}.
   */
  readonly maxUsd?: DollarAmount;
  /**
   * When the window next refreshes, ISO-8601. Absent ⇒ the provider did not say (never assume "soon").
   */
  readonly resetsAt?: ISO8601DateString;
}

/**
 * A PREPAID balance the account draws down — the windowless axis, orthogonal to {@link LlmQuotaWindow}. An
 * account can hold both (ZenMux: subscription windows for in-plan slugs, a pay-as-you-go balance for the rest),
 * and exhausting either refuses a different set of models.
 */
export interface LlmProviderBalance {
  /**
   * The ISO-4217 currency code, lower-cased as providers report it (`'usd'`).
   */
  readonly currency: string;
  /**
   * The spendable total.
   */
  readonly total: number;
  /**
   * OPTIONAL provenance breakdown (`'top-up'` / `'bonus'`), for a report that explains a total rather than just
   * stating it. Purely additive: the parts need not sum to {@link total}.
   */
  readonly parts?: ReadonlyArray<LlmProviderBalancePart>;
}

/**
 * One named component of an {@link LlmProviderBalance}.
 */
export interface LlmProviderBalancePart {
  /**
   * The human label — `'top-up'`, `'bonus'`.
   */
  readonly label: string;
  /**
   * The component's amount, in the balance's currency.
   */
  readonly amount: number;
}

/**
 * What the account-metering provider says about the current period — the value every consumer of this seam reads.
 *
 * {@link available} is the tri-state collapse a caller MUST branch on before reading anything else: a status can
 * legitimately arrive carrying no windows and no balance either because the provider meters nothing an inference
 * key can see, or because the operator has not configured the extra credential the metering endpoints require.
 * Those are both `available: false` plus an explanatory issue — never an invented `usedFraction: 0`, which would
 * read to a gate as "plenty of headroom" and is exactly the wrong answer.
 */
export interface LlmProviderStatus {
  /**
   * WHO answered ({@link LlmProviderStatusProviderId}).
   */
  readonly providerId: LlmProviderStatusProviderId;
  /**
   * `true` exactly when at least one window or a balance was actually READ from the provider. `false` ⇒ nothing
   * is known (unsupported provider, missing management credential, unreachable endpoint) and {@link issues}
   * says why. A consumer must treat `false` as "no information", NEVER as "no usage".
   */
  readonly available: boolean;
  /**
   * The metered windows, in the provider's own order (tightest-first is NOT guaranteed — ask
   * {@link tightestLlmQuotaWindow}). Empty when the provider meters none.
   */
  readonly windows: ReadonlyArray<LlmQuotaWindow>;
  /**
   * The prepaid balance, when the provider meters one.
   */
  readonly balance?: LlmProviderBalance;
  /**
   * Why {@link available} is `false`, and any advisory findings on a status that IS available — most usefully a
   * provider surcharge (a ZenMux `effective_usd_per_flow` above its base rate means the account has been flagged
   * for anomalous usage, which is worth saying out loud long before the quota runs out).
   */
  readonly issues: ReadonlyArray<LlmStrategyHealthIssue>;
}

/**
 * Per-call options for `LlmStrategy.providerStatus` — the external cancellation seam, mirroring
 * `LlmCredentialProbeOptions`.
 */
export interface LlmProviderStatusOptions {
  /**
   * An external cancellation signal, OR-combined with the read's own timeout.
   */
  readonly signal?: AbortSignal;
}

/**
 * The injectable, provider-SPECIFIC half of this seam — what a host wires onto a transport so the transport
 * itself stays provider-neutral.
 *
 * A transport exposes `LlmStrategy.providerStatus` only when a source was injected;
 * with none, the member is ABSENT, and the aggregator reads that absence as "this backend does not meter",
 * exactly as it reads a missing `credentialProbe`. That is what keeps the ZenMux endpoints out of a transport
 * whose stated contract is that it works against any OpenAI-compatible gateway.
 */
export interface LlmProviderStatusSource {
  /**
   * WHO this source speaks for — becomes {@link LlmProviderStatus.providerId}.
   */
  readonly providerId: LlmProviderStatusProviderId;
  /**
   * Read the account status. MUST NEVER throw: an unreachable endpoint / a rejected credential comes back as
   * `available: false` plus an `'error'` issue, because every caller of this is a report or a gate that has to
   * print a verdict rather than crash.
   *
   * @param options - Optional external cancellation.
   * @returns The account status.
   */
  read(options?: LlmProviderStatusOptions): Promise<LlmProviderStatus>;
}

/**
 * Build an {@link LlmQuotaWindow}, deriving {@link LlmQuotaWindow.usedFraction} from a used/max pair when the
 * provider did not report a ratio itself — the one derivation this module does, because the throttle signal has
 * to exist for a gate to work and every provider reports at least a pair.
 *
 * Guards the degenerate maximum: a `maxUnits` of `0` (or absent) yields NO fraction rather than a division
 * artifact, so a provider mid-rollover cannot present as 100% spent.
 *
 * @param config - The window fields, with `usedFraction` optional.
 * @returns The window, with a derived fraction when one could be computed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmQuotaWindow(config: LlmQuotaWindow): LlmQuotaWindow {
  const { usedFraction, usedUnits, maxUnits } = config;
  const derived = usedFraction ?? (usedUnits != null && maxUnits != null && maxUnits > 0 ? usedUnits / maxUnits : undefined);
  return derived == null ? config : { ...config, usedFraction: derived };
}

/**
 * The window CLOSEST to exhaustion — the single number a self-throttle decision turns on.
 *
 * Tightest rather than first, and rather than an average, because the windows are ANDed by the provider: a
 * 5-hour window at 95% refuses the next call however much of the 7-day window is left. Windows carrying no
 * {@link LlmQuotaWindow.usedFraction} are skipped (unknown is not zero).
 *
 * @param status - The status to inspect.
 * @returns The tightest window, or `undefined` when none carries a usable fraction.
 */
export function tightestLlmQuotaWindow(status: LlmProviderStatus): LlmQuotaWindow | undefined {
  return status.windows.reduce<LlmQuotaWindow | undefined>((tightest, window) => (window.usedFraction == null || (tightest != null && (tightest.usedFraction as number) >= window.usedFraction) ? tightest : window), undefined);
}

/**
 * Render an {@link LlmProviderStatus} as compact human lines. Every surface that shows a status renders it through
 * this, so they cannot drift into different vocabularies for the same numbers.
 *
 * @param status - The status to render.
 * @returns One line per window / balance / issue; a single explanatory line when nothing was readable.
 */
export function formatLlmProviderStatusLines(status: LlmProviderStatus): ReadonlyArray<string> {
  const lines: string[] = [];

  if (status.available) {
    status.windows.forEach((window) => {
      const percent = window.usedFraction == null ? '?' : `${(window.usedFraction * 100).toFixed(1)}%`;
      const unitSuffix = window.unit == null ? '' : ` ${window.unit}`;
      const units = window.usedUnits == null || window.maxUnits == null ? '' : ` (${roundToPrecision(window.usedUnits, 2)}/${roundToPrecision(window.maxUnits, 2)}${unitSuffix})`;
      const usd = window.usedUsd == null || window.maxUsd == null ? '' : ` ≈ $${roundToPrecision(window.usedUsd, 2)}/$${roundToPrecision(window.maxUsd, 2)}`;
      const resets = window.resetsAt == null ? '' : `, resets ${window.resetsAt}`;
      lines.push(`${window.label}: ${percent} used${units}${usd}${resets}`);
    });

    const balance = status.balance;

    if (balance != null) {
      const partList = balance.parts == null ? [] : balance.parts.map((part) => `${part.label} ${roundToPrecision(part.amount, 2)}`);
      const parts = partList.length === 0 ? '' : ` (${partList.join(', ')})`;
      lines.push(`balance: ${roundToPrecision(balance.total, 2)} ${balance.currency}${parts}`);
    }
  } else {
    lines.push(`${status.providerId}: no account usage available`);
  }

  status.issues.forEach((issue) => lines.push(`[${issue.severity}] ${issue.message}`));
  return lines;
}
