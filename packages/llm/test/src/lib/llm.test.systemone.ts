/**
 * **The one `/systemone` wire fake** — a socket-free stand-in for a gateway's System One decision route, typed as
 * `@dereekb/util/fetch`'s `ConfiguredFetch` seam. Pass its `fetch` as a decision strategy's `decisionFetch` (which also makes the
 * strategy a keyless fake), or stub the global with it (`vi.stubGlobal('fetch', fake.fetch)`) to exercise a keyed
 * strategy's real call path. Either way the WHOLE transport runs — URL, headers, body bytes, reply read — and every
 * request is recorded for a spec to assert on.
 *
 * The fake builds its well-formed replies itself ({@link toLlmSystemOneWireReply}) rather than through the root answer
 * builders, so it stays a description of the WIRE, not of the library's own types. Plain JS: no vitest, no Node API.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmDecisionRequestBody, type LlmDecisionWireReply } from '@dereekb/llm';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { hangLlmFetchFakeUntilAborted, llmFetchFakeRequestOf, llmFetchFakeResponse, type LlmFetchFakeRequest } from './llm.test.fetch';

/**
 * One request the fake received.
 */
export interface LlmSystemOneWireFakeRequest extends LlmFetchFakeRequest {
  /**
   * The parsed JSON body; `undefined` when absent or unparseable.
   */
  readonly body: Maybe<LlmDecisionRequestBody>;
}

/**
 * What the fake answers one request with.
 */
export interface LlmSystemOneWireFakeAnswer {
  /**
   * The HTTP status; default `200`.
   */
  readonly status?: Maybe<number>;
  /**
   * The response body. A string is sent verbatim; anything else is `JSON.stringify`'d. Absent ⇒ a well-formed reply to
   * the request ({@link toLlmSystemOneWireReply}).
   */
  readonly body?: unknown;
  /**
   * The response headers, read case-insensitively like `Headers.get`.
   */
  readonly headers?: Maybe<Readonly<Record<string, string>>>;
}

/**
 * Answers one request. A throw or rejection is the socket failure the `fetch` rejects with.
 *
 * @param request - The recorded request.
 * @returns The answer.
 */
export type LlmSystemOneWireFakeRespond = (request: LlmSystemOneWireFakeRequest) => LlmSystemOneWireFakeAnswer | Promise<LlmSystemOneWireFakeAnswer>;

/**
 * Config for {@link makeLlmSystemOneWireFake}.
 */
export interface LlmSystemOneWireFakeConfig {
  /**
   * How the fake answers. Absent ⇒ 200 with a well-formed reply; an answer ⇒ that answer for every request; a function
   * ⇒ called per request (a throw or rejection is the socket failure); `'hang'` ⇒ never answers, rejecting with the
   * request signal's reason once it aborts (at once when it already has).
   */
  readonly respond?: Maybe<LlmSystemOneWireFakeAnswer | LlmSystemOneWireFakeRespond | 'hang'>;
}

/**
 * The fake: its seam and what it received.
 */
export interface LlmSystemOneWireFake {
  /**
   * The seam — pass as `decisionFetch`, or stub the global `fetch` with it.
   */
  readonly fetch: ConfiguredFetch;
  /**
   * Every request received, recorded BEFORE `respond` runs (so a throwing `respond` is still recorded).
   */
  readonly requests: ReadonlyArray<LlmSystemOneWireFakeRequest>;
}

/**
 * A well-formed reply to a request body: a Choice answers its first option, a Score `0`, a Noul `0.5`, each typed; the
 * requested model is echoed.
 *
 * @param body - The request body, as the fake parsed it.
 * @returns The reply.
 *
 * @example
 * ```ts
 * toLlmSystemOneWireReply({ model: 'typesafe/jev-1.14', state: 'x', questions: { urgent: { type: 'noul', instructions: 'Is `x` urgent?' } } });
 * // { model: 'typesafe/jev-1.14', answers: { urgent: { type: 'noul', noul: 0.5 } } }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmSystemOneWireReply(body: Maybe<LlmDecisionRequestBody>): LlmDecisionWireReply {
  const answers: Record<string, unknown> = {};

  for (const [id, question] of Object.entries(body?.questions ?? {})) {
    switch (question.type) {
      case 'choice':
        answers[id] = { type: 'choice', choice: Object.keys(question.criteria)[0] };
        break;
      case 'score':
        answers[id] = { type: 'score', score: 0 };
        break;
      case 'noul':
        answers[id] = { type: 'noul', noul: 0.5 };
        break;
    }
  }

  return { ...(body?.model == null ? {} : { model: body.model }), answers };
}

/**
 * The request body parsed as JSON.
 *
 * @param body - The raw body string as sent.
 * @returns The parsed body, or `undefined` when absent or unparseable.
 */
function parsedBodyOf(body: Maybe<string>): Maybe<LlmDecisionRequestBody> {
  let parsed: Maybe<LlmDecisionRequestBody>;

  if (body != null) {
    try {
      parsed = JSON.parse(body) as LlmDecisionRequestBody;
    } catch {
      // A non-JSON body is recorded as sent (`init.body`); there is simply no parsed form to offer.
      parsed = undefined;
    }
  }

  return parsed;
}

/**
 * Turn an answer into the response the seam returns.
 *
 * @param answer - The answer.
 * @param request - The request it answers.
 * @returns The response.
 */
function toLlmSystemOneWireFakeResponse(answer: LlmSystemOneWireFakeAnswer, request: LlmSystemOneWireFakeRequest): Response {
  const body = answer.body === undefined ? toLlmSystemOneWireReply(request.body) : answer.body;
  return llmFetchFakeResponse({ status: answer.status, body, headers: answer.headers });
}

/**
 * **Build the `/systemone` wire fake.**.
 *
 * @param config - How it answers; absent ⇒ 200 with a well-formed reply to every request.
 * @returns The fake's seam and its recorded requests.
 *
 * @example
 * ```ts
 * const fake = makeLlmSystemOneWireFake({ respond: { status: 429, body: { error: { message: 'Rate limit exceeded' } } } });
 * const strategy = makeZenmuxDecisionStrategy({ decisionFetch: fake.fetch });
 * await strategy.decide(request).catch((error) => error); // LlmDecisionTransportError, status 429
 * fake.requests[0]?.url; // 'https://zenmux.ai/api/v1/systemone'
 * ```
 */
export function makeLlmSystemOneWireFake(config?: Maybe<LlmSystemOneWireFakeConfig>): LlmSystemOneWireFake {
  const requests: LlmSystemOneWireFakeRequest[] = [];
  const respond = config?.respond;

  const fakeFetch: ConfiguredFetch = async (input, init) => {
    const recorded = llmFetchFakeRequestOf(input, init);
    const request: LlmSystemOneWireFakeRequest = { ...recorded, body: parsedBodyOf(recorded.init.body) };
    requests.push(request);
    let response: Response;

    if (respond === 'hang') {
      response = await hangLlmFetchFakeUntilAborted(init?.signal);
    } else {
      const answer = typeof respond === 'function' ? await respond(request) : (respond ?? {});
      response = toLlmSystemOneWireFakeResponse(answer, request);
    }

    return response;
  };

  return { fetch: fakeFetch, requests };
}
