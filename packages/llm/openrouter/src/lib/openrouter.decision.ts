/**
 * **The OpenRouter decision transport** — an {@link LlmDecisionStrategy} over `@openrouter/sdk`'s `systemOne`
 * operation (`POST {baseUrl}/systemone`; the SDK owns the path, so a version bump follows it when it moves).
 *
 * A decision is a CAPABILITY some providers offer and others structurally cannot: this strategy is built from an
 * existing OpenRouter provider — the same name, the same key — and is deliberately distinct from the completion
 * strategy's `'openrouter'` kind, so a ledger row never confuses the decision lane with the completion lane that
 * shares its provider and its key.
 *
 * **SDK facts.** The floor is `@openrouter/sdk@1.3.8`: from that version `systemOne` resolves against the CLIENT root,
 * so one `baseUrl` governs both the decision and the `GET {baseUrl}/key` credential probe. The SDK is loaded lazily
 * from the boundary module (the core client plus the one standalone function) with `retries: none` — the dispatcher
 * owns retries.
 *
 * **What is the library's, and what is this transport's.** The declaration vocabulary, the wire mapping
 * (`llmDecisionRequestBody`), the membership-checked reply read (`readLlmDecisionAnswers`) are root `@dereekb/llm`; the
 * usage flattening ({@link llmUsageFromOpenRouterDecisionsUsage}) is this entry's own. What lives here is the
 * TRANSPORT: the lazily-built SDK call, the per-call timeout, and the failure mapping onto values the root retry
 * classifier reads.
 *
 * **The one thing this lane has that a completion cannot get.** OpenRouter returns `usage.cost` SYNCHRONOUSLY on a
 * decision reply, so a decision call carries an EXACT, final cost.
 */
import { errorMessageOf, isNotNullOrEmptyString, makeTimeoutAbortSignal, type Maybe, type Milliseconds, removeTrailingSlashes } from '@dereekb/util';
import {
  DEFAULT_LLM_DECISION_TIMEOUT_MS,
  LlmDecisionAnswerFaultError,
  LlmDecisionTransportError,
  llmDecisionRequestBody,
  llmUsageFrom,
  probeLlmCredentialEndpoint,
  readLlmDecisionAnswers,
  type LlmCredentialProbeFetch,
  type LlmCredentialProbeOptions,
  type LlmDecideOptions,
  type LlmDecisionAnswer,
  type LlmDecisionQuestions,
  type LlmDecisionRequest,
  type LlmDecisionRequestBody,
  type LlmDecisionResult,
  type LlmDecisionStrategy,
  type LlmModelId,
  type LlmStrategyHealth,
  type LlmStrategyId,
  type LlmUsage
} from '@dereekb/llm';
import { loadLlmOpenRouterSdkDecisionsCall, type LlmOpenRouterSdkDecisionsResult } from './openrouter.sdk';
import { LLM_OPENROUTER_BASE_URL } from './openrouter.strategy';

/**
 * The strategy KIND (and default instance id) of the OpenRouter decision transport — deliberately distinct from the
 * completion strategy's `'openrouter'`, so a ledger row can never confuse the two lanes.
 */
export const LLM_OPENROUTER_DECISION_STRATEGY_KIND: LlmStrategyId = 'openrouter-decisions';

/**
 * The decision reply's usage block, as the SDK decodes it — a local structural copy, so no emitted declaration names
 * `@openrouter/sdk`.
 */
export interface LlmOpenRouterDecisionsUsage {
  /**
   * The gateway's synchronous, final cost in USD.
   */
  readonly cost?: Maybe<number>;
  /**
   * Input tokens billed.
   */
  readonly inputTokens?: Maybe<number>;
  /**
   * Output tokens (reported, not billed).
   */
  readonly outputTokens?: Maybe<number>;
}

/**
 * The reply, as far as this transport reads it. Everything under `answers` is handed to `readLlmDecisionAnswers`,
 * which is the only thing that decides whether it IS an answer set.
 */
export interface LlmOpenRouterDecisionsReply {
  readonly id?: Maybe<string>;
  readonly model?: Maybe<LlmModelId>;
  readonly provider?: Maybe<string>;
  readonly answers?: Maybe<Readonly<Record<string, Maybe<LlmDecisionAnswer>>>>;
  /**
   * `cost` is the field that makes this lane different from every completion: the gateway reports it synchronously.
   */
  readonly usage?: Maybe<LlmOpenRouterDecisionsUsage>;
}

/**
 * Per-call options {@link LlmOpenRouterDecisionsCreate} receives.
 */
export interface LlmOpenRouterDecisionsCreateOptions {
  /**
   * The caller's cancellation signal.
   */
  readonly signal?: AbortSignal;
  /**
   * The call's timeout — the caller's `LlmDecideOptions.timeout`, else the strategy's.
   */
  readonly timeoutMs?: Milliseconds;
}

/**
 * The ONE call the strategy makes, injectable so a spec runs the whole transport — the assembled body included — with
 * no SDK, no key and no socket.
 */
export type LlmOpenRouterDecisionsCreate = (body: LlmDecisionRequestBody, options?: LlmOpenRouterDecisionsCreateOptions) => Promise<LlmOpenRouterDecisionsReply>;

/**
 * The `fetch` shape the SDK's HTTP client calls — {@link LlmOpenRouterDecisionStrategyConfig.decisionsFetch}.
 */
export type LlmOpenRouterDecisionsFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Config for {@link makeLlmOpenRouterDecisionStrategy}.
 */
export interface LlmOpenRouterDecisionStrategyConfig {
  /**
   * The INSTANCE id; absent ⇒ {@link LLM_OPENROUTER_DECISION_STRATEGY_KIND}. A host serving decisions from a NAMED
   * provider passes that provider's name, exactly as the completion strategies do.
   */
  readonly id?: LlmStrategyId;
  /**
   * The API key, supplied by the host — never read from the environment, which is what lets two instances bill two
   * accounts.
   */
  readonly apiKey?: string;
  /**
   * The endpoint root; absent ⇒ {@link LLM_OPENROUTER_BASE_URL}; trailing slashes trimmed. It governs BOTH the
   * decision (`POST {baseUrl}/systemone`) and the credential probe (`GET {baseUrl}/key`).
   */
  readonly baseUrl?: string;
  /**
   * The per-call timeout; absent ⇒ `DEFAULT_LLM_DECISION_TIMEOUT_MS`. A caller's `LlmDecideOptions.timeout` wins.
   */
  readonly timeoutMs?: Milliseconds;
  /**
   * The INJECTED call seam — wins over the real SDK whenever present.
   */
  readonly decisionsCreate?: LlmOpenRouterDecisionsCreate;
  /**
   * The HTTP seam {@link LlmDecisionStrategy.credentialProbe} goes through — a spec's fake. Absent ⇒ the global `fetch`.
   */
  readonly probeFetch?: LlmCredentialProbeFetch;
  /**
   * The `fetch` the REAL SDK path sends through — a spec's fake socket. Unlike {@link decisionsCreate} this does NOT
   * bypass the SDK: the client is built, the request is encoded and the reply is decoded exactly as in production,
   * only the socket is faked.
   */
  readonly decisionsFetch?: LlmOpenRouterDecisionsFetch;
}

/**
 * Flatten a decision reply's usage onto {@link LlmUsage} through the root's one usage mapper (the completion
 * spelling): input ⇒ prompt, output ⇒ completion, their sum ⇒ total, and the gateway's cost. Output tokens are
 * reported but not billed; the cost is the gateway's synchronous, final figure — the one thing a decision carries that
 * a completion cannot.
 *
 * @param usage - The reply's usage block.
 * @returns The usage, or `undefined` when the reply carried none.
 *
 * @example
 * ```ts
 * llmUsageFromOpenRouterDecisionsUsage({ inputTokens: 3800, outputTokens: 0, cost: 0.000046 });
 * // { promptTokens: 3800, completionTokens: 0, totalTokens: 3800, cost: 0.000046 }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function llmUsageFromOpenRouterDecisionsUsage(usage: Maybe<LlmOpenRouterDecisionsUsage>): Maybe<LlmUsage> {
  return usage == null
    ? undefined
    : llmUsageFrom({
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
        total_tokens: usage.inputTokens == null && usage.outputTokens == null ? undefined : (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        cost: usage.cost
      });
}

/**
 * The SDK's HTTP-client wrappers that carry the native failure as their `cause` (duck-typed by name — no SDK import).
 */
const SDK_HTTP_CLIENT_WRAPPER_NAMES: ReadonlySet<string> = new Set(['RequestAbortedError', 'RequestTimeoutError', 'ConnectionError']);

/**
 * The HTTP status carried by an SDK error, when it carries one.
 *
 * @param error - The SDK error.
 * @returns The status, or `undefined`.
 */
function statusOf(error: unknown): Maybe<number> {
  const raw = error != null && typeof error === 'object' ? (error as { readonly statusCode?: unknown; readonly status?: unknown }) : undefined;
  const status = raw?.statusCode ?? raw?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Map a failed SDK call onto the ONE value the strategy throws:
 * - the call's signal aborted ⇒ its `reason` — the timeout's `TimeoutError` or the caller's abort reason, exactly what
 *   a raw `fetch` rejects with, so the root `isAbortError` reads it and a decision retry never resends it;
 * - an SDK HTTP-client wrapper carrying a `cause` ⇒ that native cause (a socket failure such as
 *   `TypeError('fetch failed')`, which the root `isRetryableLlmError` retries);
 * - else an {@link LlmDecisionTransportError} carrying the HTTP `status` (429 / 5xx retry, 4xx do not; an SDK
 *   validation error carries none and is not retried) and the error text as `body`.
 *
 * @param error - The SDK's error value.
 * @param signal - The signal the call ran under.
 * @returns The value to throw.
 */
function llmOpenRouterDecisionsFailureOf(error: unknown, signal: AbortSignal): unknown {
  const wrapper = error != null && typeof error === 'object' ? (error as { readonly name?: unknown; readonly cause?: unknown }) : undefined;
  let failure: unknown;

  if (signal.aborted) {
    failure = signal.reason;
  } else if (wrapper != null && typeof wrapper.name === 'string' && SDK_HTTP_CLIENT_WRAPPER_NAMES.has(wrapper.name) && wrapper.cause != null) {
    failure = wrapper.cause;
  } else {
    failure = new LlmDecisionTransportError({ message: `the OpenRouter decisions endpoint failed: ${errorMessageOf(error)}`, status: statusOf(error), body: errorMessageOf(error) });
  }

  return failure;
}

/**
 * Inputs of {@link llmOpenRouterRealDecisionsCreate}.
 */
interface LlmOpenRouterRealDecisionsCreateConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: Milliseconds;
  readonly decisionsFetch?: Maybe<LlmOpenRouterDecisionsFetch>;
}

/**
 * Build the REAL create over the SDK boundary. It enforces the timeout ITSELF — `@dereekb/util` `makeTimeoutAbortSignal`, merged with the
 * caller's signal — because the SDK drops its own `timeoutMs` whenever a request carries a `signal`, so a per-call
 * timeout set on the SDK would silently vanish whenever a caller passed a cancellation signal.
 *
 * @param config - The key, endpoint root, default timeout and optional fake socket.
 * @returns The create.
 */
async function llmOpenRouterRealDecisionsCreate(config: LlmOpenRouterRealDecisionsCreateConfig): Promise<LlmOpenRouterDecisionsCreate> {
  const { apiKey, baseUrl, timeoutMs, decisionsFetch } = config;
  const call = await loadLlmOpenRouterSdkDecisionsCall({ apiKey, baseUrl, fetch: decisionsFetch });

  return async (body, options) => {
    const signal = makeTimeoutAbortSignal({ timeout: options?.timeoutMs ?? timeoutMs, signal: options?.signal });
    const result: LlmOpenRouterSdkDecisionsResult = await call(body, signal);

    if (!result.ok) {
      throw llmOpenRouterDecisionsFailureOf(result.error, signal);
    }

    // Only the REPLY is cast, onto the lax shape the membership check reads.
    return result.value as LlmOpenRouterDecisionsReply;
  };
}

/**
 * **Build an OpenRouter decision transport.**.
 *
 * @param config - The key, the endpoint and the injectable seams.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const decisions = makeLlmOpenRouterDecisionStrategy({ apiKey });
 * const { answers, usage } = await decisions.decide({ model: 'typesafe/jev-1.14', state: { ticket }, questions: { spam: llmNoulQuestion('`ticket` is unsolicited marketing.') } });
 * ```
 */
export function makeLlmOpenRouterDecisionStrategy(config: LlmOpenRouterDecisionStrategyConfig = {}): LlmDecisionStrategy {
  const id = config.id ?? LLM_OPENROUTER_DECISION_STRATEGY_KIND;
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? LLM_OPENROUTER_BASE_URL);
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_DECISION_TIMEOUT_MS;
  // The real create is built once on first need and reused; an injected `decisionsCreate` never triggers it, which is
  // what keeps the SDK off every seam spec's import graph.
  let cachedCreate: LlmOpenRouterDecisionsCreate | undefined;

  const resolveCreate = async (): Promise<LlmOpenRouterDecisionsCreate> => {
    let create = config.decisionsCreate ?? cachedCreate;

    if (create == null) {
      const apiKey = config.apiKey;

      if (!isNotNullOrEmptyString(apiKey)) {
        // No status ⇒ never retried: a missing key does not heal on a resend.
        throw new LlmDecisionTransportError({ message: `llm openrouter decision strategy '${id}': no apiKey configured and no decisionsCreate injected (the host must supply apiKey or gate startup with a readiness check).` });
      }

      cachedCreate = await llmOpenRouterRealDecisionsCreate({ apiKey, baseUrl, timeoutMs, decisionsFetch: config.decisionsFetch });
      create = cachedCreate;
    }

    return create;
  };

  const decide = async <Q extends LlmDecisionQuestions>(request: LlmDecisionRequest<Q>, options?: LlmDecideOptions): Promise<LlmDecisionResult<Q>> => {
    const create = await resolveCreate();
    const body = llmDecisionRequestBody(request);
    const reply = await create(body, { timeoutMs: options?.timeout ?? timeoutMs, ...(options?.signal == null ? {} : { signal: options.signal }) });
    const read = readLlmDecisionAnswers({ questions: request.questions, raw: reply.answers ?? {} });

    // A reply that left its declared answer space is a FAULT, never a value — so this THROWS rather than handing back
    // half an answer set.
    if (read.faults != null) {
      throw new LlmDecisionAnswerFaultError(read.faults);
    }

    const usage = llmUsageFromOpenRouterDecisionsUsage(reply.usage);
    return { model: reply.model ?? request.model, answers: read.answers, ...(usage == null ? {} : { usage }), ...(reply.id == null ? {} : { generationId: reply.id }), ...(reply.provider == null ? {} : { provider: reply.provider }) };
  };

  return {
    id,
    kind: LLM_OPENROUTER_DECISION_STRATEGY_KIND,
    describe: `OpenRouter decisions at ${baseUrl}`,
    decide,
    async healthCheck(): Promise<LlmStrategyHealth> {
      // Injected seam ⇒ ready WITHOUT any real check: a fake must never trigger a key / SDK construction (the
      // contract's network-free guarantee). Construction never sends a request.
      let health: LlmStrategyHealth;

      if (config.decisionsCreate != null) {
        health = { ready: true, issues: [] };
      } else if (isNotNullOrEmptyString(config.apiKey)) {
        try {
          await resolveCreate();
          health = { ready: true, issues: [] };
        } catch (error) {
          // swallow site 'llm/openrouter-decision.client' — the verdict carries the failure.
          health = { ready: false, issues: [{ severity: 'error', message: `the '${id}' decisions client could not be constructed: ${errorMessageOf(error)}` }] };
        }
      } else {
        health = { ready: false, issues: [{ severity: 'error', message: 'no apiKey configured and no decisionsCreate injected' }] };
      }

      return health;
    },
    async credentialProbe(options?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth> {
      const probeFetch = config.probeFetch;
      let health: LlmStrategyHealth;

      if (probeFetch == null && config.decisionsCreate != null) {
        health = { ready: true, issues: [] };
      } else if (isNotNullOrEmptyString(config.apiKey)) {
        // `GET /key` is OpenRouter's free key-metadata endpoint — the SAME probe the completion sibling runs, because it
        // is the same account. A revoked key answers `401 "User not found."` verbatim.
        health = await probeLlmCredentialEndpoint({
          strategyId: id,
          url: `${baseUrl}/key`,
          apiKey: config.apiKey,
          ...(probeFetch == null ? {} : { fetch: probeFetch }),
          ...(options?.signal == null ? {} : { signal: options.signal })
        });
      } else {
        health = { ready: false, issues: [{ severity: 'error', message: 'no apiKey configured and no decisionsCreate injected' }] };
      }

      return health;
    }
  };
}
