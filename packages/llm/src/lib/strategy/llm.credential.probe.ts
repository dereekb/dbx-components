/**
 * The shared CREDENTIAL-LIVENESS primitive behind a strategy's `credentialProbe` — one authenticated, free,
 * non-billable request against the provider, mapped onto an {@link LlmStrategyHealth}.
 *
 * **Why this exists as its own seam.** A strategy's `healthCheck` guarantees NO network round-trip, and callers lean
 * on that; widening it would break the guarantee for every caller. But network-freedom is exactly what makes it blind
 * to the failure this module exists for: a well-formed but REVOKED key. A revoked key passes every non-network check,
 * constructs a perfectly good client, and fails only at the provider — so a fail-open host silently degrades (its
 * fallbacks absorb every failed call) instead of refusing to start.
 *
 * The probe is opt-in, never on the dispatch path, and never throws.
 */

import { type AbortSignalRef, cutStringFunction, readErrorMessage, isNotNullOrEmptyString, isPlainObject, makeTimeoutAbortSignal, type Maybe, type Milliseconds, type WebsiteUrlWithPrefix, type WebsiteUrl } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonTextResult, readFetchJsonText } from '@dereekb/util/fetch';
import { type LlmStrategyId } from '../model/llm.value';
import { resolveLlmFetch } from './llm.fetch';
import { type LlmCredentialProbe, type LlmCredentialProbeOptions } from './llm.strategy';
import { type LlmStrategyHealth, type LlmStrategyHealthSeverity } from './llm.strategy.health';

/**
 * The default wall-clock budget for one credential probe. Deliberately SHORT: this runs in front of a launch
 * gate, so a slow provider must cost seconds, not the call timeout's minutes.
 */
export const DEFAULT_LLM_CREDENTIAL_PROBE_TIMEOUT_MS: Milliseconds = 15_000;

/**
 * How much of an unparseable provider error body is carried into the issue message before truncation.
 */
const MAX_PROVIDER_MESSAGE_LENGTH = 240;

/**
 * Cuts a message-less error body to {@link MAX_PROVIDER_MESSAGE_LENGTH} characters, then marks the cut with `…`.
 */
const cutLlmProviderMessage = cutStringFunction({ maxLength: MAX_PROVIDER_MESSAGE_LENGTH, endText: '…', maxLengthIncludesEndText: false });

/**
 * Config for {@link probeLlmCredentialEndpoint}.
 */
export interface ProbeLlmCredentialEndpointConfig extends AbortSignalRef {
  /**
   * The probing strategy's id — prefixes every issue message so an aggregated report names the backend.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The absolute endpoint URL to GET (`{baseUrl}/key`, `{baseUrl}/models`, …). MUST be free / non-billable.
   */
  readonly url: WebsiteUrlWithPrefix;
  /**
   * The credential under test — sent as `Authorization: Bearer …`, never logged.
   */
  readonly apiKey: string;
  /**
   * The HTTP seam; defaults to the global `fetch`, read at call time. A spec passes a fake so the probe stays network-free.
   */
  readonly fetch?: Maybe<ConfiguredFetch>;
  /**
   * The probe timeout in ms; defaults to {@link DEFAULT_LLM_CREDENTIAL_PROBE_TIMEOUT_MS}.
   */
  readonly timeoutMs?: Milliseconds;
  /**
   * How to treat a `404` on the probe endpoint. `'error'` (default) ⇒ unready. `'warning'` ⇒ READY with an
   * advisory — the right verdict for a generic OpenAI-compatible gateway that simply does not implement the
   * endpoint: not-implemented is not the same finding as not-authorized, and turning an unknown-but-working
   * gateway red would block every launch behind it.
   */
  readonly notFoundSeverity?: LlmStrategyHealthSeverity;
  /**
   * A JSON body to POST instead of the default GET. Only meaningful with {@link rejectedStatuses}: the body must be
   * one the gateway REFUSES after authenticating (an unknown model), so the probe never runs a completion.
   */
  readonly postBody?: string;
  /**
   * The AUTH-GATED mode. When set, ONLY these statuses mean the credential was rejected; any other 4xx means the
   * gateway authenticated the key and refused something else (the probe's deliberately invalid request), so the
   * key is live. A 5xx verifies nothing and stays an error.
   *
   * It exists because some gateways answer the free GET endpoints to ANY bearer: ZenMux's `GET /models` returned
   * 200 to a made-up key, so the plain mode could never report a revoked key there.
   */
  readonly rejectedStatuses?: ReadonlyArray<number>;
}

/**
 * The error body a provider answers with: OpenRouter / OpenAI-compatible gateways nest it
 * (`{"error":{"message":"User not found.","code":401}}`), ZenMux answers it flat (`{"success":false,"message":"Invalid API key"}`).
 */
export interface LlmProviderErrorBody {
  readonly error?: unknown;
  readonly message?: unknown;
}

/**
 * Extract the provider's OWN error message from a response read. A nested or flat `message` wins; anything else degrades
 * to the trimmed, truncated raw body. Carrying the provider's words verbatim is the point — "User not found." tells an
 * operator to reissue the key, where a synthesized "auth failed" does not.
 *
 * @param read - The body text and its decoded JSON, as {@link readFetchJsonText} returns them.
 * @returns The provider's message, or `undefined` when the body carried none.
 */
export function llmProviderErrorMessage(read: Pick<FetchJsonTextResult, 'text' | 'json'>): string | undefined {
  const trimmed = read.text.trim();
  let message: string | undefined;

  if (trimmed.length > 0) {
    const body: Maybe<LlmProviderErrorBody> = isPlainObject(read.json) ? read.json : undefined;
    const error = body?.error;
    const nested = isPlainObject(error) && typeof error['message'] === 'string' ? error['message'] : undefined;
    const flat = typeof body?.message === 'string' ? body.message : undefined;

    if (nested != null || flat != null) {
      message = nested ?? flat;
    } else {
      // Swallow site `llm/credential-probe.error-body`. A body with no message (an HTML error page from a proxy in front of the gateway) is not a fault — the raw text is
      // still the most informative thing available. Health channel: the verdict carries it.
      message = cutLlmProviderMessage(trimmed);
    }
  }

  return message;
}

/**
 * Run ONE authenticated, free request against a provider and map the outcome onto an {@link LlmStrategyHealth}.
 * NEVER throws: an unreachable host, a timeout, and a rejected key all come back as `ready:false` + an
 * `'error'` issue carrying whatever the provider said.
 *
 * @param config - The strategy id, endpoint, credential, and optional fetch / signal / timeout / 404 policy / auth-gated POST.
 * @returns The credential verdict.
 */
export async function probeLlmCredentialEndpoint(config: ProbeLlmCredentialEndpointConfig): Promise<LlmStrategyHealth> {
  const fetchImpl = resolveLlmFetch(config.fetch);
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_CREDENTIAL_PROBE_TIMEOUT_MS;
  const rejectedStatuses = config.rejectedStatuses;
  let health: LlmStrategyHealth;

  try {
    // Built INSIDE the try: should the runtime's abort-signal API throw, the catch below turns that into the usual
    // unready verdict instead of breaking "never throws" (`makeTimeoutAbortSignal` feature-detects a missing API itself).
    const signal = makeTimeoutAbortSignal({ timeout: timeoutMs, signal: config.signal });
    const init: RequestInit = config.postBody == null ? { method: 'GET', headers: { Authorization: `Bearer ${config.apiKey}` }, signal } : { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }, body: config.postBody, signal };
    const response = await fetchImpl(config.url, init);

    if (response.ok) {
      health = { ready: true, issues: [] };
    } else {
      // A liveness probe never reads an ok body (it must not download a `/models` catalog); a refusal is read once.
      const read = await readFetchJsonText(Promise.resolve(response));
      const message = llmProviderErrorMessage(read);
      const detail = message == null ? `HTTP ${response.status}` : `HTTP ${response.status}: ${message}`;

      if (rejectedStatuses != null && response.status < 500 && !rejectedStatuses.includes(response.status)) {
        // AUTH-GATED: the gateway got past authentication and refused the probe's invalid request instead.
        health = { ready: true, issues: [] };
      } else if (response.status === 404 && config.notFoundSeverity === 'warning') {
        // Not-implemented ≠ not-authorized. A gateway without the probe endpoint stays launchable.
        health = { ready: true, issues: [{ severity: 'warning', message: `${config.strategyId} credential probe endpoint ${config.url} is not implemented by this gateway (${detail}); the credential could not be verified.` }] };
      } else {
        health = { ready: false, issues: [{ severity: 'error', message: `${config.strategyId} rejected the configured credential at ${config.url}: ${detail}` }] };
      }
    }
  } catch (error) {
    // The whole point of the probe is to report, never to propagate — a launch gate calling it must be able to
    // print a verdict rather than crash. Health channel: the verdict IS the report.
    health = { ready: false, issues: [{ severity: 'error', message: `${config.strategyId} credential probe could not reach ${config.url}: ${readErrorMessage(error)}` }] };
  }

  return health;
}

/**
 * What a transport's own credential probe receives.
 */
export interface LlmCredentialProbeParams extends AbortSignalRef {
  /**
   * The probing strategy's id.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The strategy's base URL, trailing slashes removed.
   */
  readonly baseUrl: WebsiteUrl;
  /**
   * The credential under test.
   */
  readonly apiKey: string;
  /**
   * The HTTP seam; defaults to the global `fetch`.
   */
  readonly fetch?: Maybe<ConfiguredFetch>;
}

/**
 * A transport's own credential probe, e.g. `GET {baseUrl}/models` or {@link probeLlmCredentialEndpoint} against a gateway's
 * key endpoint. The completion and decision strategies hand theirs to {@link runLlmCredentialProbeLadder}.
 */
export type LlmTransportCredentialProbe = (params: LlmCredentialProbeParams) => Promise<LlmStrategyHealth>;

/**
 * Config for {@link runLlmCredentialProbeLadder}.
 */
export interface RunLlmCredentialProbeLadderConfig {
  readonly strategyId: LlmStrategyId;
  /**
   * The strategy's base URL, trailing slashes removed.
   */
  readonly baseUrl: WebsiteUrl;
  readonly apiKey: Maybe<string>;
  /**
   * Whether a fake transport seam (a chat `client`, a `decisionFetch`) was injected.
   */
  readonly injected: boolean;
  /**
   * The message for a strategy with neither a key nor an injected seam; each strategy words its own.
   */
  readonly missingKeyMessage: string;
  /**
   * The fetch seam handed to the transport probe.
   */
  readonly probeFetch?: Maybe<ConfiguredFetch>;
  /**
   * A host's (or a credential-probe adapter's) own probe. Outranks an injected seam.
   */
  readonly probeSource?: Maybe<LlmCredentialProbe>;
  /**
   * The transport's own probe.
   */
  readonly probe: LlmTransportCredentialProbe;
  readonly options?: Maybe<LlmCredentialProbeOptions>;
}

/**
 * The ONE credential-probe ladder every strategy's `credentialProbe` runs, rung by rung.
 *
 * Rungs:
 *
 * 1. no injected seam and no key → an error verdict with {@link RunLlmCredentialProbeLadderConfig.missingKeyMessage};
 * 2. a probe source → delegated to it (an explicit source outranks an injected seam);
 * 3. an injected seam and no probe fetch → ready, no request sent (a fake transport has no credential to verify);
 * 4. a key → the transport's own probe;
 * 5. otherwise → an error verdict: no apiKey configured for the credential probe.
 *
 * @param config - The strategy's key, seams and probes.
 * @returns The credential verdict.
 */
export async function runLlmCredentialProbeLadder(config: RunLlmCredentialProbeLadderConfig): Promise<LlmStrategyHealth> {
  const { strategyId, baseUrl, apiKey, injected, probeFetch, probeSource, options } = config;
  const hasKey = isNotNullOrEmptyString(apiKey);
  let health: LlmStrategyHealth;

  if (!injected && !hasKey) {
    health = { ready: false, issues: [{ severity: 'error', message: config.missingKeyMessage }] };
  } else if (probeSource != null) {
    health = await probeSource(options ?? undefined);
  } else if (injected && probeFetch == null) {
    health = { ready: true, issues: [] };
  } else if (hasKey) {
    health = await config.probe({ strategyId, baseUrl, apiKey, fetch: probeFetch, signal: options?.signal });
  } else {
    health = { ready: false, issues: [{ severity: 'error', message: `no apiKey configured for the credential probe` }] };
  }

  return health;
}
