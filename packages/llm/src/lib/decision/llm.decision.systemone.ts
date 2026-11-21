/**
 * **The System One decision transport** — the ONE {@link LlmDecisionStrategy} implementation behind every gateway that
 * serves TypeSafe's decision route at `POST <baseUrl>/systemone` (OpenRouter and ZenMux today). A gateway is a hook set
 * ({@link LlmSystemOneDecisionStrategyHooks}) over it: its kind, its label, its default base URL, the header its
 * generation id rides (if any), what its reported cost is, whether its answers arrive type-less, and its credential
 * probe. Everything else — the body, the HTTP call, the failure mapping, the reply read, the usage fold and the result
 * assembly — is spelt here once.
 *
 * **Why a raw `fetch`, not a gateway SDK.** An SDK decodes the reply through its own strict schema —
 * `usage.input_tokens` / `usage.output_tokens` required integers, a `type` literal on every answer — and its credential
 * probe is its own gateway's. A gateway that omits a single field the SDK requires would turn every decision into a
 * decode error the membership check never got to see. So this transport reads the reply LAX and leaves the one
 * judgement that matters — "is this an answer to the question that was asked?" — to {@link requireLlmDecisionAnswers},
 * which also checks the value types an SDK decode used to guarantee (a `noul`, a `score` and each distribution entry
 * must be numbers).
 *
 * The lax reads, each documented where it happens:
 *
 * 1. An answer that arrives WITHOUT a `type` is given the declared question's type first — only when the hooks set
 *    `laxAnswerTypes` (a gateway whose reply lists the value fields, not the discriminator). A PRESENT `type` is never
 *    overwritten.
 * 2. `usage` is read field by field ({@link llmDecisionReplyBilling}), so a reply that reports less is recorded as
 *    what it reported rather than refused. A non-object `usage` reads as absent; a non-object `answers` as no answers.
 *    The bill is read BEFORE the answers, so an answer fault carries the usage of the send it faulted.
 * 3. `id`, `model` and `provider` count only as non-blank strings; with no `model` echoed, the requested slug stands.
 *
 * **The error contract** — `decide` throws exactly one of:
 *
 * - the signal's own reason when the call was aborted or timed out (a `TimeoutError`, or the caller's reason) — never
 *   wrapped, so a retry never resends a cancelled call;
 * - {@link LlmDecisionTransportError} with no `status` for a missing key (never retried), or with the socket failure as
 *   its `cause` for an unreachable route (`isRetryableLlmDecisionError` classifies it by that cause);
 * - {@link LlmDecisionTransportError} with `status`, the raw `body` and the response `headers` for a non-2xx answer
 *   (the dispatcher's default backoff honors its `Retry-After`), or with `status` and `body` for a 2xx whose body is not
 *   a JSON object;
 * - {@link LlmDecisionAnswerFaultError} for a reply that left its declared answer space.
 *
 * `healthCheck` is network-free; `credentialProbe` runs the hook's probe. Both report rather than throw. The global
 * `fetch` is read at CALL time, never at import or construction, so the module stays browser-safe and a spec may stub
 * the global after building the strategy.
 */

import { readErrorMessage, isNotNullOrEmptyString, isPlainObject, makeTimeoutAbortSignal, type Maybe, type Milliseconds, removeTrailingSlashes, type WebsiteUrlWithPrefix, type WebsiteUrl } from '@dereekb/util';
import { type LlmDecisionAdapterConfig } from '../adapter/llm.adapter';
import { type LlmModelId, type LlmStrategyId } from '../model/llm.value';
import { type ConfiguredFetch, type FetchJsonTextResult, isFetchAbortError, readFetchJsonText } from '@dereekb/util/fetch';
import { llmProviderErrorMessage, runLlmCredentialProbeLadder, type LlmTransportCredentialProbe } from '../strategy/llm.credential.probe';
import { resolveLlmFetch } from '../strategy/llm.fetch';
import { type LlmCredentialProbeOptions } from '../strategy/llm.strategy';
import { type LlmStrategyHealth } from '../strategy/llm.strategy.health';
import { type LlmCostBasis } from '../strategy/llm.usage';
import { requireLlmDecisionAnswers } from './llm.decision.answer';
import { type LlmDecisionQuestions } from './llm.decision.question';
import { DEFAULT_LLM_DECISION_TIMEOUT_MS, LlmDecisionTransportError, type LlmDecideOptions, type LlmDecisionRequest, type LlmDecisionResult, type LlmDecisionStrategy } from './llm.decision.strategy';
import { llmDecisionReplyBilling, llmDecisionRequestBody, type LlmDecisionWireReply } from './llm.decision.wire';

/**
 * The route path under a gateway's base URL — spelt once, for every gateway.
 */
export const LLM_SYSTEM_ONE_DECISION_PATH = '/systemone';

/**
 * The host / instance config of a System One decision strategy — what an adapter or a host passes. Never read from the
 * environment, which is what lets two instances bill two accounts.
 */
export interface LlmSystemOneDecisionStrategyConfig {
  /**
   * The INSTANCE id; absent ⇒ the hooks' `kind`. A host serving decisions from a NAMED provider passes that provider's
   * id.
   */
  readonly id?: Maybe<LlmStrategyId>;
  /**
   * The API key — the provider's own, resolved by the host. Sent as `Authorization: Bearer …`.
   */
  readonly apiKey?: Maybe<string>;
  /**
   * WHICH env var supplied {@link apiKey} — a LABEL for the readiness messages only. Absent ⇒ the messages say "pass an
   * apiKey".
   */
  readonly apiKeyEnv?: Maybe<string>;
  /**
   * The endpoint root; absent ⇒ the hooks' `defaultBaseUrl`. Trailing slashes are trimmed. The decision goes to
   * `<baseUrl>/systemone`; the credential probe receives the same trimmed root.
   */
  readonly baseUrl?: Maybe<WebsiteUrl>;
  /**
   * The per-call timeout; absent ⇒ {@link DEFAULT_LLM_DECISION_TIMEOUT_MS}. A caller's `LlmDecideOptions.timeoutMs` wins.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * The INJECTED decision HTTP seam — a spec's fake. The whole transport still runs over it (URL, headers, body, reply
   * read), so a spec pins the wire with no socket. An injected seam marks the strategy as a keyless fake: `decide`,
   * `healthCheck` and `credentialProbe` skip their key checks.
   */
  readonly decisionFetch?: Maybe<ConfiguredFetch>;
  /**
   * The HTTP seam the credential probe goes through — a spec's fake.
   */
  readonly probeFetch?: Maybe<ConfiguredFetch>;
}

/**
 * **A gateway's definition** over the System One transport — static per gateway, so each provider entry keeps one
 * private constant of it and its factory passes the host's config through untouched.
 */
export interface LlmSystemOneDecisionStrategyHooks {
  /**
   * The TRANSPORT kind the strategy reports — what a call record reads as its `strategyKind` and what a cost fold
   * groups on. Stable: stored call rows fold on it. Also the default instance id.
   */
  readonly kind: LlmStrategyId;
  /**
   * The gateway's display name (`'OpenRouter'`, `'ZenMux'`) — used in `describe` and every message.
   */
  readonly label: string;
  /**
   * The endpoint root used when the config names none.
   */
  readonly defaultBaseUrl: WebsiteUrlWithPrefix;
  /**
   * The response header read for the generation id when the body carries no `id`. Absent ⇒ the body `id` is the only
   * carrier.
   */
  readonly generationIdHeader?: Maybe<string>;
  /**
   * What a reported `cost` IS when it is not the bill ({@link LlmCostBasis}); stamped only beside a cost. Absent ⇒ the
   * cost is unstamped (exact and final).
   */
  readonly costBasis?: Maybe<LlmCostBasis>;
  /**
   * Whether a type-less answer takes its declared question's type before the membership check — the reader's
   * `laxAnswerTypes`. Absent ⇒ strict: a type-less answer faults as `answer-mistyped`.
   */
  readonly laxAnswerTypes?: Maybe<boolean>;
  /**
   * The gateway's own credential probe — one free, authenticated request. Must report, never throw.
   *
   * @param params - The strategy id, trimmed base URL, key and optional seam / signal.
   * @returns The credential verdict.
   */
  readonly credentialProbe: LlmTransportCredentialProbe;
}

/**
 * The input of {@link readLlmSystemOneRoute}.
 */
interface ReadLlmSystemOneRouteInput {
  readonly fetch: ConfiguredFetch;
  readonly url: WebsiteUrl;
  readonly init: RequestInit;
  readonly signal: AbortSignal;
  readonly label: string;
}

/**
 * The HTTP read — the call and the body read in ONE `try`, so a failure while reading the body maps exactly like a
 * failure to connect. An aborted signal rejects with its own reason; an abort-shaped error propagates as itself;
 * anything else (a reset socket, DNS) is wrapped so it names the route, keeping the failure as its `cause`.
 *
 * @param input - The seam, the route, the request init, the signal it runs under and the gateway's label.
 * @returns The response, its body text (read once, so a non-2xx can carry the provider's own words) and the decoded JSON.
 */
async function readLlmSystemOneRoute(input: ReadLlmSystemOneRouteInput): Promise<FetchJsonTextResult<LlmDecisionWireReply>> {
  const { url, signal } = input;
  let reply: FetchJsonTextResult<LlmDecisionWireReply>;

  try {
    reply = await readFetchJsonText<LlmDecisionWireReply>(input.fetch(url, input.init));
  } catch (error) {
    if (signal.aborted) {
      throw signal.reason;
    } else if (isFetchAbortError(error)) {
      throw error;
    }

    throw new LlmDecisionTransportError({ message: `the ${input.label} System One route ${url} could not be reached: ${readErrorMessage(error)}`, cause: error });
  }

  return reply;
}

/**
 * Whether a decoded reply is a JSON object — the one shape the reply read accepts.
 *
 * @param reply - The decoded body (the caller's claim, unvalidated).
 * @returns True for a plain object.
 */
function isLlmDecisionWireReplyObject(reply: Maybe<LlmDecisionWireReply>): reply is LlmDecisionWireReply {
  return isPlainObject(reply);
}

/**
 * Map one decision adapter config onto {@link LlmSystemOneDecisionStrategyConfig}: `id` / `apiKey` from the provider,
 * then `baseUrl`, `timeoutMs` and `probeFetch` (from `fetch`), each passed through (nullish when unset; the strategy
 * defaults with `??`). Every System One decision adapter starts from it; a gateway adds its own keys on top (ZenMux
 * adds `apiKeyEnv`).
 *
 * @param config - The resolved decision adapter config.
 * @returns The strategy config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmSystemOneDecisionStrategyConfig(config: LlmDecisionAdapterConfig): LlmSystemOneDecisionStrategyConfig {
  const { provider, baseUrl, timeoutMs, fetch } = config;
  return {
    id: provider.id,
    apiKey: provider.apiKey,
    baseUrl,
    timeoutMs,
    probeFetch: fetch
  };
}

/**
 * **Build a System One decision strategy** for one gateway: the host's config over the gateway's hooks.
 *
 * @param config - The key, the endpoint and the injectable seams — the host's.
 * @param hooks - The gateway's definition.
 * @returns The decision strategy.
 *
 * @example
 * ```ts
 * const decisions = makeLlmSystemOneDecisionStrategy({ apiKey }, { kind: 'my-gateway-systemone', label: 'MyGateway', defaultBaseUrl: 'https://gateway.example/api/v1', credentialProbe: (params) => probeMyGateway(params) });
 * const { answers } = await decisions.decide({ model: 'typesafe/jev-1.14', state: { ticket }, questions: { spam: llmNoulQuestion('`ticket` is unsolicited marketing.') } });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmSystemOneDecisionStrategy(config: LlmSystemOneDecisionStrategyConfig, hooks: LlmSystemOneDecisionStrategyHooks): LlmDecisionStrategy {
  const { label, generationIdHeader } = hooks;
  const id = config.id ?? hooks.kind;
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? hooks.defaultBaseUrl);
  const url = `${baseUrl}${LLM_SYSTEM_ONE_DECISION_PATH}`;
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_DECISION_TIMEOUT_MS;
  const keyRemedy = config.apiKeyEnv == null ? 'pass an apiKey' : `set ${config.apiKeyEnv}`;
  const injectedFetch = config.decisionFetch;
  // The global is read INSIDE the call, so nothing touches `fetch` at import or construction.
  const decisionFetch = resolveLlmFetch(injectedFetch);
  const keyless = !isNotNullOrEmptyString(config.apiKey);

  const decide = async <Q extends LlmDecisionQuestions>(request: LlmDecisionRequest<Q>, options?: LlmDecideOptions): Promise<LlmDecisionResult<Q>> => {
    if (injectedFetch == null && keyless) {
      // No status ⇒ never retried: a missing key does not heal on a resend.
      throw new LlmDecisionTransportError({ message: `${label} decision strategy '${id}': no apiKey configured and no decisionFetch injected (${keyRemedy}, or gate startup via the readiness check).` });
    }

    // The body is EXACTLY `{ model, state, questions }`, built field by field, so a host-extended request object can
    // never leak a key onto the wire (ZenMux answers `400 invalid_params` to any other body key).
    const body = llmDecisionRequestBody(request);
    const signal = makeTimeoutAbortSignal({ timeout: options?.timeoutMs ?? timeoutMs, signal: options?.signal });
    const init: RequestInit = { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey ?? ''}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal };
    const read = await readLlmSystemOneRoute({ fetch: decisionFetch, url, init, signal, label });
    const { response, text, json: reply } = read;
    const status = response.status;

    if (!response.ok) {
      const message = llmProviderErrorMessage(read);
      const detail = message == null ? '' : `: ${message}`;
      throw new LlmDecisionTransportError({ message: `the ${label} System One route ${url} answered HTTP ${status}${detail}`, status, body: text, headers: response.headers });
    }

    // Not a swallow: a non-JSON body is refused here, exactly like a JSON body that is not an object.
    if (!isLlmDecisionWireReplyObject(reply)) {
      throw new LlmDecisionTransportError({ message: `the ${label} System One route ${url} answered HTTP ${status} with a body that is not a JSON object`, status, body: text });
    }

    // The bill is read BEFORE the answers, so a reply that left its answer space still records what the send cost. A
    // body `id` wins; the hooks' header is read only when the body carries none.
    const { model: repliedModel, ...billed } = llmDecisionReplyBilling(reply, { costBasis: hooks.costBasis, generationId: generationIdHeader == null ? undefined : response.headers.get(generationIdHeader) });
    const model: LlmModelId = repliedModel ?? request.model;
    // A reply that left its declared answer space THROWS rather than handing back half an answer set.
    const answers = requireLlmDecisionAnswers({ questions: request.questions, raw: isPlainObject(reply.answers) ? reply.answers : {}, laxAnswerTypes: hooks.laxAnswerTypes, billing: { model, ...billed } });

    // `answers` is generic in Q, so it sits beside the bill rather than inside it; key order is kept.
    return { model, answers, ...billed };
  };

  return {
    id,
    kind: hooks.kind,
    describe: `${label} System One at ${url}`,
    decide,
    async healthCheck(): Promise<LlmStrategyHealth> {
      // Injected seam ⇒ ready WITHOUT any real check: a fake must never require a key. There is no client to construct,
      // so a key is all a real call needs — and no request is sent.
      return injectedFetch == null && keyless ? { ready: false, issues: [{ severity: 'error', message: `no decisions API key is configured for '${id}': ${keyRemedy}` }] } : { ready: true, issues: [] };
    },
    credentialProbe(probeOptions?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth> {
      return runLlmCredentialProbeLadder({
        strategyId: id,
        baseUrl,
        apiKey: config.apiKey,
        injected: injectedFetch != null,
        missingKeyMessage: `no apiKey configured and no decisionFetch injected (${keyRemedy})`,
        probeFetch: config.probeFetch,
        probe: hooks.credentialProbe,
        options: probeOptions
      });
    }
  };
}
