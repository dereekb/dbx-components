/**
 * The ZenMux {@link LlmProviderStatusSource} — the ONLY module that knows ZenMux's account endpoints, so that the billed lanes
 * which consume the verdict can keep not knowing which gateway they are on.
 *
 * Three free, authenticated GETs against `<base>/management`, mapped onto the neutral shape:
 *
 * | endpoint | contributes |
 * | --- | --- |
 * | `subscription/detail` | the `rolling-5h` / `rolling-7d` / `monthly` {@link LlmQuotaWindow}s — the throttle signal |
 * | `payg/balance` | the {@link LlmProviderBalance} the `*-free` slugs and out-of-plan models draw on |
 * | `flow_rate` | the surcharge advisory (`effective_usd_per_flow` > `base_usd_per_flow` ⇒ flagged usage) |
 *
 * **The credential is a THIRD key, and there is no way around it.** These endpoints reject both inference keys with
 * `403 {"success":false,"message":"Invalid API key"}` — verified on 2026-08-25 for all three endpoints × both keys. ZenMux
 * issues a separate **Management API Key** (console → Management) whose only job is this. Its absence is reported as an
 * `'error'` issue on an `available: false` status rather than by throwing — an operator who has not made one yet must still
 * be able to run everything they could run before. (The `management/generation?id=` endpoint is the exception that DOES
 * accept the pay-as-you-go inference key, but it is per-call retrospective billing, not a quota: `./zenmux.generation.bill`.)
 *
 * **Flows, and why `usedUsd` is not a rate you may reuse.** ZenMux meters subscription consumption in "Flows", a composite
 * of tokens + request overhead whose USD value FLOATS (`base_usd_per_flow`, ~$0.0328 when measured). The window's
 * `used_value_usd` / `max_value_usd` are the provider's own conversion AT READ TIME. They are reported because a human
 * reading "57 of 800 flows" learns less than "$1.88 of $26.27", and they are documented as non-arithmetic because
 * subtracting two reads taken at different rates is meaningless.
 *
 * Partial success is a first-class outcome: the three GETs are independent, and a status carrying the windows but no balance
 * (or vice versa) is strictly more useful than a total failure. Each failure contributes its own issue and the status stays
 * `available` as long as ANY of them landed.
 */

import { llmProviderErrorMessage, makeLlmQuotaWindow, type LlmCredentialProbeFetch, type LlmCredentialProbeResponse, type LlmProviderBalance, type LlmProviderStatus, type LlmProviderStatusOptions, type LlmProviderStatusSource, type LlmQuotaWindow, type LlmStrategyHealthIssue } from '@dereekb/llm';
import { errorMessageOf, makeTimeoutAbortSignal, type Maybe, type Milliseconds, removeTrailingSlashes } from '@dereekb/util';
import { DEFAULT_ZENMUX_BASE_URL, ZENMUX_MANAGEMENT_API_KEY_ENV, ZENMUX_PROVIDER_ID } from './zenmux.constants';

/**
 * The default wall-clock budget for ONE account read. Short for the same reason the credential probe's is: this runs in
 * front of a launch gate, so a slow provider must cost seconds rather than the call timeout's minutes.
 */
export const DEFAULT_ZENMUX_PROVIDER_STATUS_TIMEOUT_MS: Milliseconds = 15_000;

/**
 * Config for {@link makeZenmuxProviderStatusSource}.
 */
export interface ZenmuxProviderStatusSourceConfig {
  /**
   * The **Management API Key**. Empty / absent ⇒ every read resolves `available: false` with an issue naming the env var to
   * set; the source is still constructible, so a host can wire it unconditionally and let the report explain itself.
   */
  readonly managementApiKey?: Maybe<string>;
  /**
   * The API base URL; defaults to {@link DEFAULT_ZENMUX_BASE_URL}. Trailing slashes are stripped.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * The HTTP seam — a spec's fake. Absent ⇒ the global `fetch`. Reuses the credential probe's request/response shapes: both
   * are authenticated GETs whose body is read as text.
   */
  readonly fetch?: LlmCredentialProbeFetch;
  /**
   * The per-read timeout; defaults to {@link DEFAULT_ZENMUX_PROVIDER_STATUS_TIMEOUT_MS}.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * WHICH env var supplied {@link managementApiKey} — named in the missing-credential issue so an operator is told what to
   * set. Defaults to {@link ZENMUX_MANAGEMENT_API_KEY_ENV}.
   */
  readonly managementApiKeyEnv?: Maybe<string>;
}

/**
 * The `subscription/detail` payload subset this module reads. Modeled locally (rather than trusting the wire) because every
 * field is optional on a plan that does not have it — a pay-as-you-go-only account has no subscription at all and answers
 * with an empty `data`.
 */
interface ZenmuxSubscriptionDetail {
  readonly currency?: string;
  readonly base_usd_per_flow?: number;
  readonly effective_usd_per_flow?: number;
  readonly account_status?: string;
  readonly quota_5_hour?: ZenmuxQuota;
  readonly quota_7_day?: ZenmuxQuota;
  readonly quota_monthly?: ZenmuxQuota;
}

/**
 * One ZenMux quota window as it arrives on the wire.
 */
interface ZenmuxQuota {
  readonly usage_percentage?: number;
  readonly resets_at?: string;
  readonly max_flows?: number;
  readonly used_flows?: number;
  readonly remaining_flows?: number;
  readonly used_value_usd?: number;
  readonly max_value_usd?: number;
}

/**
 * The `payg/balance` payload subset.
 */
interface ZenmuxPaygBalance {
  readonly currency?: string;
  readonly total_credits?: number;
  readonly top_up_credits?: number;
  readonly bonus_credits?: number;
}

/**
 * The `flow_rate` payload subset.
 */
interface ZenmuxFlowRate {
  readonly base_usd_per_flow?: number;
  readonly effective_usd_per_flow?: number;
}

/**
 * The envelope every ZenMux management endpoint answers in.
 */
interface ZenmuxEnvelope<T> {
  readonly success?: boolean;
  readonly message?: string;
  readonly data?: Maybe<T>;
}

/**
 * The outcome of one GET — the data, or the reason there is none. Modeled rather than thrown so the three reads can
 * partially succeed.
 */
interface ZenmuxReadResult<T> {
  readonly data?: T;
  readonly error?: string;
}

/**
 * Build the ZenMux account-status source.
 *
 * Construction is inert — no socket opens until {@link LlmProviderStatusSource.read} is called — so a host can wire it during
 * strategy assembly without cost. A read never throws.
 *
 * @param config - The management credential, and optional base URL / fetch seam / timeout / key label.
 * @returns The status source.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeZenmuxProviderStatusSource(config: ZenmuxProviderStatusSourceConfig): LlmProviderStatusSource {
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? DEFAULT_ZENMUX_BASE_URL);
  const apiKey = config.managementApiKey?.trim() ?? '';
  const managementApiKeyEnv = config.managementApiKeyEnv ?? ZENMUX_MANAGEMENT_API_KEY_ENV;
  const timeoutMs = config.timeoutMs ?? DEFAULT_ZENMUX_PROVIDER_STATUS_TIMEOUT_MS;
  const fetchImpl: LlmCredentialProbeFetch = config.fetch ?? ((url, init) => fetch(url, init) as unknown as Promise<LlmCredentialProbeResponse>);

  /**
   * GET one management endpoint and unwrap its envelope. Never throws.
   *
   * @param path - The endpoint path below `/management`.
   * @param options - Optional external cancellation.
   * @returns The data, or the reason there is none.
   */
  async function read<T>(path: string, options?: LlmProviderStatusOptions): Promise<ZenmuxReadResult<T>> {
    const url = `${baseUrl}/management/${path}`;
    let result: ZenmuxReadResult<T>;

    try {
      // Built INSIDE the try: should the runtime's abort-signal API throw, the catch below turns that into this read's
      // warning instead of breaking "never throws" (`makeTimeoutAbortSignal` feature-detects a missing API itself).
      const signal = makeTimeoutAbortSignal({ timeout: timeoutMs, signal: options?.signal });
      const response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, signal });
      const body = await response.text();

      if (response.ok) {
        let envelope: Maybe<ZenmuxEnvelope<T>>;

        try {
          envelope = JSON.parse(body) as ZenmuxEnvelope<T>;
        } catch {
          // Swallow site `llm/zenmux-provider-status.envelope`. A 200 carrying a non-JSON body means something in front of
          // the gateway answered (a proxy error page); it becomes this read's error string.
          envelope = undefined;
        }

        const data = envelope?.data;
        const missingReason = envelope?.message ?? 'response carried no data';

        if (envelope == null) {
          result = { error: `${path}: unparseable response body` };
        } else {
          result = data == null ? { error: `${path}: ${missingReason}` } : { data };
        }
      } else {
        // The provider's OWN words: a `403 Invalid API key` here means the operator passed an INFERENCE key, which is the
        // single most likely misconfiguration and needs to be quoted, not paraphrased.
        const message = llmProviderErrorMessage(body);
        const detail = message == null ? '' : `: ${message}`;
        result = { error: `${path}: HTTP ${response.status}${detail}` };
      }
    } catch (error) {
      // Swallow site `llm/zenmux-provider-status.transport`. An unreachable endpoint is this read's warning, never a throw.
      result = { error: `${path}: ${errorMessageOf(error)}` };
    }

    return result;
  }

  return {
    providerId: ZENMUX_PROVIDER_ID,
    async read(options?: LlmProviderStatusOptions): Promise<LlmProviderStatus> {
      let status: LlmProviderStatus;

      if (apiKey.length === 0) {
        // The expected state on a machine that has not made a management key yet. An 'error' issue (so a report shows it
        // prominently) on an `available: false` status (so no gate can read it as headroom).
        status = { providerId: ZENMUX_PROVIDER_ID, available: false, windows: [], issues: [{ severity: 'error', message: `no ZenMux management key configured. Set ${managementApiKeyEnv} (create one at zenmux.ai/platform/management; the inference keys are rejected by the account endpoints).` }] };
      } else {
        const [subscription, balance, flowRate] = await Promise.all([read<ZenmuxSubscriptionDetail>('subscription/detail', options), read<ZenmuxPaygBalance>('payg/balance', options), read<ZenmuxFlowRate>('flow_rate', options)]);
        const windows = subscription.data == null ? [] : zenmuxQuotaWindows(subscription.data);
        const providerBalance = balance.data == null ? undefined : zenmuxBalance(balance.data);
        const issues: LlmStrategyHealthIssue[] = [];

        // A failed read is a WARNING, not an error: the other two may well have landed, and turning a partial read red would
        // block a launch over a diagnostic. The missing-credential case above is the error.
        [subscription.error, balance.error, flowRate.error].forEach((error) => {
          if (error != null) {
            issues.push({ severity: 'warning', message: `ZenMux account read failed: ${error}` });
          }
        });

        const surcharge = zenmuxSurchargeIssue(flowRate.data ?? subscription.data);

        if (surcharge != null) {
          issues.push(surcharge);
        }

        status = { providerId: ZENMUX_PROVIDER_ID, available: windows.length > 0 || providerBalance != null, windows, ...(providerBalance == null ? {} : { balance: providerBalance }), issues };
      }

      return status;
    }
  };
}

/**
 * Map a `subscription/detail` payload onto the neutral windows.
 *
 * The monthly entry carries a ceiling but no consumption (ZenMux reports `max_flows` only), so it contributes a window with no
 * `usedFraction` — present for context, invisible to `tightestLlmQuotaWindow`, which is exactly right: a ceiling nobody is
 * measured against cannot be the binding constraint.
 *
 * @param detail - The payload.
 * @returns The windows the payload described (empty for an account with no subscription).
 */
function zenmuxQuotaWindows(detail: ZenmuxSubscriptionDetail): ReadonlyArray<LlmQuotaWindow> {
  const specs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly quota: Maybe<ZenmuxQuota> }> = [
    { id: 'rolling-5h', label: 'rolling 5 hours', quota: detail.quota_5_hour },
    { id: 'rolling-7d', label: 'rolling 7 days', quota: detail.quota_7_day },
    { id: 'monthly', label: 'monthly', quota: detail.quota_monthly }
  ];

  return specs.flatMap(({ id, label, quota }) =>
    quota == null
      ? []
      : [
          makeLlmQuotaWindow({
            id,
            label,
            unit: 'flow',
            ...(quota.usage_percentage == null ? {} : { usedFraction: quota.usage_percentage }),
            ...(quota.used_flows == null ? {} : { usedUnits: quota.used_flows }),
            ...(quota.max_flows == null ? {} : { maxUnits: quota.max_flows }),
            ...(quota.remaining_flows == null ? {} : { remainingUnits: quota.remaining_flows }),
            ...(quota.used_value_usd == null ? {} : { usedUsd: quota.used_value_usd }),
            ...(quota.max_value_usd == null ? {} : { maxUsd: quota.max_value_usd }),
            ...(quota.resets_at == null ? {} : { resetsAt: quota.resets_at })
          })
        ]
  );
}

/**
 * Map a `payg/balance` payload onto the neutral balance.
 *
 * @param payload - The payload.
 * @returns The balance, or `undefined` when the payload carried no total.
 */
function zenmuxBalance(payload: ZenmuxPaygBalance): Maybe<LlmProviderBalance> {
  const parts = [
    { label: 'top-up', amount: payload.top_up_credits },
    { label: 'bonus', amount: payload.bonus_credits }
  ].flatMap((part) => (part.amount == null ? [] : [{ label: part.label, amount: part.amount }]));

  return payload.total_credits == null ? undefined : { currency: payload.currency ?? 'usd', total: payload.total_credits, ...(parts.length === 0 ? {} : { parts }) };
}

/**
 * The SURCHARGE advisory — ZenMux raises `effective_usd_per_flow` above `base_usd_per_flow` for an account it has flagged for
 * anomalous usage, which silently shrinks every window's real headroom. Worth saying out loud well before the quota itself
 * runs out, and invisible in the quota numbers alone.
 *
 * @param rates - Whichever payload carried the two rates (`flow_rate`, or `subscription/detail` which repeats them).
 * @returns The advisory issue, or `undefined` when the effective rate is at or below base.
 */
function zenmuxSurchargeIssue(rates: Maybe<ZenmuxFlowRate>): Maybe<LlmStrategyHealthIssue> {
  const base = rates?.base_usd_per_flow;
  const effective = rates?.effective_usd_per_flow;
  return base == null || effective == null || effective <= base ? undefined : { severity: 'warning', message: `ZenMux is charging above the base rate ($${effective}/flow vs $${base}/flow). The account is flagged for anomalous usage, so every quota window buys less than its flow count suggests.` };
}
