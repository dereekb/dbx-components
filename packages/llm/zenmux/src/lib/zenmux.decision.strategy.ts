/**
 * **ZenMux's System One route — the {@link LlmDecisionStrategy} a keyed ZenMux provider serves decisions through.** The only
 * module that knows the `/systemone` socket.
 *
 * ZenMux serves TypeSafe's decision route at `POST <baseUrl>/systemone` (`https://zenmux.ai/api/v1/systemone`), Jev included
 * (`typesafe/jev-1.14`), on BOTH the subscription and the pay-as-you-go key. The request is the TypeSafe shape every decision
 * backend speaks — `{ model, state, questions: { <id>: { type, instructions, criteria } } }` — built by the root's
 * {@link llmDecisionRequestBody}, so the declaration layer, the wire mapping and the membership-checked reply read are all
 * SHARED with every other decision transport. What is ZenMux's own is only the socket.
 *
 * **Why a raw `fetch`, not an SDK pointed at another server URL.** An SDK decodes the reply through its own strict schema —
 * `usage.input_tokens` / `usage.output_tokens` required integers, a `type` literal on every answer — and its credential probe
 * is its own gateway's, which ZenMux does not serve. A gateway that omits a single field the SDK requires would turn every
 * decision into a decode error the membership check never got to see. So this transport reads the reply LAX and leaves the
 * one judgement that matters — "is this an answer to the question that was asked?" — to {@link readLlmDecisionAnswers}.
 *
 * Two lax reads, both documented where they happen:
 *
 * 1. An answer that arrives WITHOUT a `type` is given the declared question's type before the membership check (TypeSafe's
 *    HTTP reference lists the value fields — `noul`, `choice`, `score` — not the discriminator). A PRESENT `type` is never
 *    overwritten, so a Noul answered as a Choice still faults as `answer-mistyped`.
 * 2. `usage` is read field by field (`input_tokens` / `output_tokens` / `cost`, each optional), so a reply that reports less
 *    is recorded as what it reported rather than refused.
 *
 * **The generation id rides a HEADER, not the body.** The reply carries no `id`; ZenMux answers every call with an
 * `X-ZenMux-RequestId` header instead, and that value IS the `generationId` its dashboard and `management/generation?id=` key
 * the call by (probed 2026-10-02). It is read off the header so a decision row joins back to the dashboard exactly as a
 * completion row does — the only join there is, because the route accepts NO caller metadata: its body schema is strict, and
 * `metadata`, `trace`, `session_id` and `user` each answer `400 invalid_params` (same probe). Run attribution therefore lives on
 * the host's own call record, found by that id.
 *
 * Built from an EXISTING provider — the same id and the same key its completion lane bills — so serving decisions takes no
 * new secret.
 */

import {
  DEFAULT_LLM_DECISION_TIMEOUT_MS,
  isAbortError,
  llmDecisionRequestBody,
  LlmDecisionAnswerFaultError,
  LlmDecisionTransportError,
  llmProviderErrorMessage,
  llmUsageFrom,
  readLlmDecisionAnswers,
  type LlmCredentialProbeFetch,
  type LlmCredentialProbeOptions,
  type LlmDecideOptions,
  type LlmDecisionAnswer,
  type LlmDecisionQuestions,
  type LlmDecisionRequest,
  type LlmDecisionResult,
  type LlmDecisionStrategy,
  type LlmStrategyHealth,
  type LlmStrategyId
} from '@dereekb/llm';
import { errorMessageOf, isNotNullOrEmptyString, makeTimeoutAbortSignal, type Maybe, type Milliseconds, removeTrailingSlashes } from '@dereekb/util';
import { ZENMUX_SYNC_COST_BASIS } from './zenmux.account';
import { DEFAULT_ZENMUX_BASE_URL } from './zenmux.constants';
import { probeZenmuxCredential } from './zenmux.credential.probe';

/**
 * The TRANSPORT kind a ZenMux decision strategy reports — what a call record reads as its `strategyKind` and what a cost
 * fold groups on. Distinct from every completion kind, so a decision can never be confused with the OpenAI-transport
 * completion lane that shares its provider and its key. The value is stable: stored call rows fold on it.
 */
export const ZENMUX_DECISION_STRATEGY_KIND: LlmStrategyId = 'zenmux-systemone';

/**
 * The route path under the provider's base URL. Spelt once: there is no SDK here to own it.
 */
export const ZENMUX_DECISION_PATH = '/systemone';

/**
 * The response header ZenMux carries its generation id in — the id the dashboard and `management/generation?id=` look a call
 * up by. The `/systemone` body carries no `id` of its own, so this is the only handle there is.
 */
export const ZENMUX_REQUEST_ID_HEADER = 'x-zenmux-requestid';

/**
 * The request this transport sends — always an authenticated JSON POST.
 */
export interface ZenmuxDecisionRequestInit {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal?: AbortSignal;
}

/**
 * The response surface this transport reads — the `fetch` `Response` subset, modelled locally so a spec passes a fake with
 * no socket. The body is read as TEXT so a non-2xx can carry the provider's own words and a non-JSON 200 can be reported
 * rather than thrown as a `SyntaxError`.
 */
export interface ZenmuxDecisionResponse {
  readonly ok: boolean;
  readonly status: number;
  /**
   * The response headers, read for {@link ZENMUX_REQUEST_ID_HEADER}. Optional so a fake with no headers still answers; the
   * reply then simply carries no `generationId`.
   */
  readonly headers?: { get(name: string): Maybe<string> };
  text(): Promise<string>;
}

/**
 * The HTTP seam a decision goes through — the global `fetch` in production, a fake in every spec.
 *
 * @param url - The absolute route URL.
 * @param init - The authenticated POST init.
 * @returns The response.
 */
export type ZenmuxDecisionFetch = (url: string, init: ZenmuxDecisionRequestInit) => Promise<ZenmuxDecisionResponse>;

/**
 * The reply, as far as this transport reads it. Everything under `answers` is handed to {@link readLlmDecisionAnswers},
 * which is the only thing that decides whether it IS an answer set.
 */
export interface ZenmuxDecisionReply {
  readonly id?: Maybe<string>;
  readonly model?: Maybe<string>;
  readonly provider?: Maybe<string>;
  readonly answers?: Maybe<Readonly<Record<string, unknown>>>;
  /**
   * The wire spelling (snake_case), every field optional. `cost` is input-only at the model's input rate when it arrives (the
   * measured behaviour of the TypeSafe route, whose price sheet ZenMux shares).
   */
  readonly usage?: Maybe<{ readonly input_tokens?: Maybe<number>; readonly output_tokens?: Maybe<number>; readonly cost?: Maybe<number> }>;
}

/**
 * Config for {@link makeZenmuxDecisionStrategy}.
 */
export interface ZenmuxDecisionStrategyConfig {
  /**
   * The INSTANCE id; absent ⇒ {@link ZENMUX_DECISION_STRATEGY_KIND}. A host serving decisions from a NAMED provider passes
   * that provider's id.
   */
  readonly id?: Maybe<LlmStrategyId>;
  /**
   * The API key — the provider's own, resolved by the host. Never read from the environment here, which is what lets a
   * subscription and a pay-as-you-go provider bill two accounts.
   */
  readonly apiKey?: Maybe<string>;
  /**
   * WHICH env var supplied {@link apiKey} — a LABEL for the readiness messages only. Absent ⇒ the messages say "pass an
   * apiKey".
   */
  readonly apiKeyEnv?: Maybe<string>;
  /**
   * The endpoint root; absent ⇒ {@link DEFAULT_ZENMUX_BASE_URL}. Trailing slashes are stripped. The decision goes to
   * `<baseUrl>/systemone` and the credential probe to `<baseUrl>/chat/completions` + `<baseUrl>/management/generation`.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * The per-call timeout; absent ⇒ {@link DEFAULT_LLM_DECISION_TIMEOUT_MS}.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * The INJECTED decision HTTP seam — a spec's fake. The whole transport still runs over it (URL, headers, body, reply read),
   * so a spec pins the wire with no socket. An injected seam marks the strategy as a keyless fake: `healthCheck` and
   * `credentialProbe` skip their key checks.
   */
  readonly decisionFetch?: Maybe<ZenmuxDecisionFetch>;
  /**
   * The HTTP seam {@link LlmDecisionStrategy.credentialProbe} goes through — a spec's fake.
   */
  readonly probeFetch?: Maybe<LlmCredentialProbeFetch>;
}

/**
 * The raw answers with every TYPE-LESS answer given the declared question's type — lax read (1) of the module docblock. A
 * present `type` is never touched, an answer to an undeclared id is passed through for the membership check to ignore, and a
 * non-object answer is left for it to fault.
 *
 * @param questions - The declared questions.
 * @param raw - The answers as returned.
 * @returns The answers, ready for {@link readLlmDecisionAnswers}.
 */
function withDeclaredAnswerTypes(questions: LlmDecisionQuestions, raw: Readonly<Record<string, unknown>>): Readonly<Record<string, Maybe<LlmDecisionAnswer>>> {
  const typed: Record<string, Maybe<LlmDecisionAnswer>> = {};

  for (const [id, answer] of Object.entries(raw)) {
    const question = questions[id];
    const typeless = question != null && answer != null && typeof answer === 'object' && (answer as { readonly type?: unknown }).type == null;
    typed[id] = (typeless ? { ...answer, type: question.type } : answer) as Maybe<LlmDecisionAnswer>;
  }

  return typed;
}

/**
 * **Build a ZenMux decision strategy** over `POST <baseUrl>/systemone`.
 *
 * `decide` throws {@link LlmDecisionTransportError} for a missing key, an unreachable route (the socket failure kept as its
 * `cause`), a non-2xx answer (with `status` and `body`) and a non-JSON body; an abort or timeout propagates as itself; a reply
 * that left its declared answer space throws {@link LlmDecisionAnswerFaultError}. `healthCheck` is network-free and
 * `credentialProbe` runs {@link probeZenmuxCredential}; both report rather than throw.
 *
 * @param config - The key, the endpoint and the injectable seams.
 * @returns The decision strategy.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeZenmuxDecisionStrategy(config: ZenmuxDecisionStrategyConfig = {}): LlmDecisionStrategy {
  const id = config.id ?? ZENMUX_DECISION_STRATEGY_KIND;
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? DEFAULT_ZENMUX_BASE_URL);
  const url = `${baseUrl}${ZENMUX_DECISION_PATH}`;
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_DECISION_TIMEOUT_MS;
  const keyRemedy = config.apiKeyEnv == null ? 'pass an apiKey' : `set ${config.apiKeyEnv}`;
  const injectedFetch = config.decisionFetch;
  const decisionFetch: ZenmuxDecisionFetch = injectedFetch ?? ((target, init) => fetch(target, init) as unknown as Promise<ZenmuxDecisionResponse>);
  const keyless = !isNotNullOrEmptyString(config.apiKey);

  const decide = async <Q extends LlmDecisionQuestions>(request: LlmDecisionRequest<Q>, options?: LlmDecideOptions): Promise<LlmDecisionResult<Q>> => {
    if (injectedFetch == null && keyless) {
      throw new LlmDecisionTransportError({ message: `${id} decisions strategy: no apiKey configured and no decisionFetch injected (${keyRemedy}, or gate startup via the readiness check).` });
    }

    // The body is EXACTLY `{ model, state, questions }`, built field by field, so a host-extended request object can never
    // leak a key onto the wire: the route answers `400 invalid_params` to any other body key (the module docblock's probe).
    const body = llmDecisionRequestBody(request);
    const signal = makeTimeoutAbortSignal({ timeout: options?.timeout ?? timeoutMs, signal: options?.signal });
    let response: ZenmuxDecisionResponse;

    try {
      response = await decisionFetch(url, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey ?? ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    } catch (error) {
      // An abort / timeout propagates AS ITSELF — the dispatcher's own classifier reads it, exactly as it reads the completion
      // lane's. Anything else (a reset socket, DNS) is wrapped so it carries the route it failed on, and keeps the failure as
      // its `cause` so the retry classifier can still read a transient one.
      if (isAbortError(error)) {
        throw error;
      }

      throw new LlmDecisionTransportError({ message: `the ZenMux System One route ${url} could not be reached: ${errorMessageOf(error)}`, cause: error });
    }

    const text = await response.text();

    if (!response.ok) {
      const message = llmProviderErrorMessage(text);
      const detail = message == null ? '' : `: ${message}`;
      throw new LlmDecisionTransportError({ message: `the ZenMux System One route ${url} answered HTTP ${response.status}${detail}`, status: response.status, body: text });
    }

    let reply: ZenmuxDecisionReply;

    try {
      reply = JSON.parse(text) as ZenmuxDecisionReply;
    } catch {
      throw new LlmDecisionTransportError({ message: `the ZenMux System One route ${url} answered HTTP ${response.status} with a body that is not JSON`, status: response.status, body: text });
    }

    const read = readLlmDecisionAnswers({ questions: request.questions, raw: withDeclaredAnswerTypes(request.questions, reply.answers ?? {}) });

    // A reply that left its declared answer space is a FAULT, never a value — so this THROWS rather than handing back half an
    // answer set. A caller wanting a fallback expresses it as a verdict of its own.
    if (read.faults != null) {
      throw new LlmDecisionAnswerFaultError(read.faults);
    }

    const wireUsage = reply.usage;
    const inputTokens = wireUsage?.input_tokens ?? undefined;
    const outputTokens = wireUsage?.output_tokens ?? undefined;
    const cost = wireUsage?.cost ?? undefined;
    // The ONE usage fold reads the completion spelling; a measurement the reply did not report is OMITTED, so an absent `cost`
    // reads downstream as "cost unknown" rather than "cost zero". A reported one is ZenMux's sync figure, stamped as its list
    // price (measured on completions, 2026-10-21): an upper bound on the bill, which is still true of an exact figure, so the
    // stamp can only be conservative.
    const usage = wireUsage == null ? undefined : llmUsageFrom({ prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens == null && outputTokens == null ? undefined : (inputTokens ?? 0) + (outputTokens ?? 0), ...(cost == null ? {} : { cost }) }, { costBasis: ZENMUX_SYNC_COST_BASIS });

    // A body `id` wins when a later gateway version starts sending one; today the header is the only carrier.
    const generationId = reply.id ?? response.headers?.get(ZENMUX_REQUEST_ID_HEADER) ?? undefined;

    return { model: reply.model ?? request.model, answers: read.answers, ...(usage == null ? {} : { usage }), ...(isNotNullOrEmptyString(generationId) ? { generationId } : {}), ...(reply.provider == null ? {} : { provider: reply.provider }) };
  };

  return {
    id,
    kind: ZENMUX_DECISION_STRATEGY_KIND,
    describe: `ZenMux System One at ${url}`,
    decide,
    async healthCheck(): Promise<LlmStrategyHealth> {
      // Injected seam ⇒ ready WITHOUT any real check: a fake must never require a key (the contract's network-free guarantee).
      // There is no client to construct, so a key is all a real call needs.
      return injectedFetch == null && keyless ? { ready: false, issues: [{ severity: 'error', message: `no decisions API key is configured for '${id}': ${keyRemedy}` }] } : { ready: true, issues: [] };
    },
    async credentialProbe(probeOptions?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth> {
      const probeFetch = config.probeFetch;
      const apiKey = config.apiKey;
      let health: LlmStrategyHealth;

      if (probeFetch == null && injectedFetch != null) {
        health = { ready: true, issues: [] };
      } else if (isNotNullOrEmptyString(apiKey)) {
        // The SAME probe the ZenMux completion lane runs, because it is the same account and the same key. Not `GET /models`:
        // ZenMux answers that 200 to any bearer, so it could never report a revoked key.
        health = await probeZenmuxCredential({ strategyId: id, baseUrl, apiKey, ...(probeFetch == null ? {} : { fetch: probeFetch }), ...(probeOptions?.signal == null ? {} : { signal: probeOptions.signal }) });
      } else {
        health = { ready: false, issues: [{ severity: 'error', message: `no apiKey configured and no decisionFetch injected (${keyRemedy})` }] };
      }

      return health;
    }
  };
}
