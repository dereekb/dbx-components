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

import { errorMessageOf, makeTimeoutAbortSignal, type Milliseconds, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type LlmStrategyId } from '../model/llm.value';
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
 * The response surface a credential probe reads — the `fetch` `Response` subset, modeled locally so a spec can
 * pass a fake without a socket.
 */
export interface LlmCredentialProbeResponse {
  /**
   * `true` for a 2xx status.
   */
  readonly ok: boolean;
  /**
   * The HTTP status code — `401` is the revoked/rejected credential this probe exists to catch.
   */
  readonly status: number;
  /**
   * The raw body text, from which the provider's own error message is extracted.
   *
   * @returns The body text.
   */
  text(): Promise<string>;
}

/**
 * The request shape a credential probe sends — an authenticated GET, or (for an {@link ProbeLlmCredentialEndpointConfig.rejectedStatuses}
 * AUTH-GATED probe) a POST carrying a body the gateway refuses AFTER authenticating.
 */
export interface LlmCredentialProbeRequestInit {
  readonly method: 'GET' | 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

/**
 * The HTTP seam a credential probe goes through — the global `fetch` in production, a fake in a spec. Injected
 * via {@link ProbeLlmCredentialEndpointConfig.fetch} so every probe test stays network-free.
 *
 * @param url - The absolute endpoint URL.
 * @param init - The authenticated GET init.
 * @returns The response.
 */
export type LlmCredentialProbeFetch = (url: string, init: LlmCredentialProbeRequestInit) => Promise<LlmCredentialProbeResponse>;

/**
 * Config for {@link probeLlmCredentialEndpoint}.
 */
export interface ProbeLlmCredentialEndpointConfig {
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
   * The HTTP seam; defaults to the global `fetch`.
   */
  readonly fetch?: LlmCredentialProbeFetch;
  /**
   * An EXTERNAL cancellation signal, OR-combined with the probe's own timeout.
   */
  readonly signal?: AbortSignal;
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
 * Extract the provider's OWN error message from a response body. Providers answer
 * `{"error":{"message":"User not found.","code":401}}` (OpenRouter / OpenAI alike); anything else degrades to the
 * trimmed, truncated raw body. Carrying the provider's words verbatim is the point — "User not found." tells an
 * operator to reissue the key, where a synthesized "auth failed" does not.
 *
 * @param body - The raw response body text.
 * @returns The provider's message, or `undefined` when the body carried none.
 */
export function llmProviderErrorMessage(body: string): string | undefined {
  const trimmed = body.trim();
  let message: string | undefined;

  if (trimmed.length > 0) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // A non-JSON body (an HTML error page from a proxy in front of the gateway) is not a fault — the raw
      // text below is still the most informative thing available. Health channel: the verdict carries it.
      parsed = undefined;
    }

    const error = (parsed as { readonly error?: { readonly message?: unknown }; readonly message?: unknown } | undefined)?.error;
    const nested = typeof error?.message === 'string' ? error.message : undefined;
    const flat = typeof (parsed as { readonly message?: unknown } | undefined)?.message === 'string' ? ((parsed as { readonly message: string }).message as string) : undefined;
    message = nested ?? flat ?? (trimmed.length > MAX_PROVIDER_MESSAGE_LENGTH ? `${trimmed.slice(0, MAX_PROVIDER_MESSAGE_LENGTH)}…` : trimmed);
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
  const fetchImpl = config.fetch ?? ((url: string, init: LlmCredentialProbeRequestInit) => fetch(url, init) as unknown as Promise<LlmCredentialProbeResponse>);
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_CREDENTIAL_PROBE_TIMEOUT_MS;
  const rejectedStatuses = config.rejectedStatuses;
  let health: LlmStrategyHealth;

  try {
    // Built INSIDE the try: should the runtime's abort-signal API throw, the catch below turns that into the usual
    // unready verdict instead of breaking "never throws" (`makeTimeoutAbortSignal` feature-detects a missing API itself).
    const signal = makeTimeoutAbortSignal({ timeout: timeoutMs, signal: config.signal });
    const init: LlmCredentialProbeRequestInit = config.postBody == null ? { method: 'GET', headers: { Authorization: `Bearer ${config.apiKey}` }, signal } : { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }, body: config.postBody, signal };
    const response = await fetchImpl(config.url, init);

    if (response.ok) {
      health = { ready: true, issues: [] };
    } else {
      const body = await response.text();
      const message = llmProviderErrorMessage(body);
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
    health = { ready: false, issues: [{ severity: 'error', message: `${config.strategyId} credential probe could not reach ${config.url}: ${errorMessageOf(error)}` }] };
  }

  return health;
}
