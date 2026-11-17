/**
 * The single boundary between `@dereekb/llm/openrouter` and `@openrouter/sdk`. It is reached only through
 * `import type` (erased) and `import()` (deferred), so importing the entry never evaluates the SDK, and every export
 * here is typed with local structural types, so no emitted declaration names the SDK.
 *
 * It loads the SDK's tree-shaking form — the minimal core client plus the ONE standalone function the decision lane
 * needs (`systemOneCreate`, `POST {baseUrl}/systemone`) — so the chat / completions surface is never pulled in behind
 * a decision. The floor is `@openrouter/sdk@1.3.8`: from that version `systemOne` resolves against the CLIENT root, so
 * one `baseUrl` governs both the decision and the `/key` credential probe.
 */
import type { DecisionsRequest } from '@openrouter/sdk/models';
import { type Maybe } from '@dereekb/util';
import { type LlmDecisionRequestBody } from '@dereekb/llm';

/**
 * What {@link loadLlmOpenRouterSdkDecisionsCall} builds the SDK client from.
 */
export interface LlmOpenRouterSdkDecisionsConfig {
  /**
   * The OpenRouter API key.
   */
  readonly apiKey: string;
  /**
   * The endpoint root (already trimmed of trailing slashes).
   */
  readonly baseUrl: string;
  /**
   * A `fetch` the SDK's HTTP client sends through instead of the global one (a spec's fake socket). Spelled
   * structurally (the decision module's `LlmOpenRouterDecisionsFetch`) so this boundary imports nothing from it.
   */
  readonly fetch?: Maybe<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>;
}

/**
 * The SDK call's result, unmapped: the decoded reply, or the SDK's error value. Mapping errors is the strategy's job.
 */
export type LlmOpenRouterSdkDecisionsResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown };

/**
 * One decision call through the SDK. The `signal` is the call's ONLY deadline: the boundary sets no SDK `timeoutMs`
 * (the SDK drops its own timeout whenever a request carries a signal), so the caller merges its timeout into it.
 */
export type LlmOpenRouterSdkDecisionsCall = (body: LlmDecisionRequestBody, signal: AbortSignal) => Promise<LlmOpenRouterSdkDecisionsResult>;

/**
 * Lazily load `@openrouter/sdk` and build the decision call: an `OpenRouterCore` pointed at `baseUrl` with
 * `retryConfig: none` (the dispatcher owns retries), optionally over an injected `fetch`, and a call that runs
 * `systemOneCreate` with `retries: none` and the caller's signal.
 *
 * @param config - The key, endpoint root and optional fetch.
 * @returns The decision call.
 */
export async function loadLlmOpenRouterSdkDecisionsCall(config: LlmOpenRouterSdkDecisionsConfig): Promise<LlmOpenRouterSdkDecisionsCall> {
  const { apiKey, baseUrl, fetch } = config;
  const [{ OpenRouterCore }, { systemOneCreate }, { HTTPClient }] = await Promise.all([import('@openrouter/sdk/core'), import('@openrouter/sdk/funcs/systemOneCreate'), import('@openrouter/sdk/lib/http')]);
  // A fake socket, when injected, replaces ONLY the fetch: the request is still encoded and the reply still decoded by
  // the real SDK, which is how a spec pins the wire URL with no network.
  const client = new OpenRouterCore({ apiKey, serverURL: baseUrl, retryConfig: { strategy: 'none' }, ...(fetch == null ? {} : { httpClient: new HTTPClient({ fetcher: (input, init) => fetch(input, init) }) }) });

  return async (body, signal) => {
    // The body is the library's `llmDecisionRequestBody` — the SDK's `DecisionsRequest` wire shape, spelled locally.
    const result = await systemOneCreate(client, { decisionsRequest: body as unknown as DecisionsRequest }, { retries: { strategy: 'none' }, signal });
    return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error };
  };
}
