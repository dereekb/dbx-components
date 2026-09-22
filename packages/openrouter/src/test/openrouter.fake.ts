/**
 * Test doubles for the core package's own suite.
 *
 * The client faked here is a REAL {@link OpenRouterCore} wired to a stub `fetcher`, never a hand-rolled
 * object with a stubbed method. The difference is the whole point of the fixture: a scenario asserting
 * something about an outgoing request is then asserting against the bytes OpenRouter would actually
 * receive, after the SDK's own outbound serialization — which is where a field silently gets renamed or
 * dropped.
 *
 * The URL is recorded alongside the body, and that is not incidental. A fake injected ABOVE the SDK
 * stays green no matter which route the SDK resolves, so a suite built that way cannot see a call going
 * to the wrong path at all — which is exactly how the decisions route was once shipped 404ing on every
 * live request with a fully green suite. Pin the URL.
 */

import { HTTPClient } from '@openrouter/sdk';
import { OpenRouterCore } from '@openrouter/sdk/core';
import { type Maybe } from '@dereekb/util';

/**
 * One request the fake received, exactly as it went on the wire.
 */
export interface FakeOpenRouterRequest {
  /**
   * The full request url, including the path the SDK resolved.
   */
  readonly url: string;
  readonly method: string;
  /**
   * The parsed request body.
   */
  readonly body: Record<string, unknown>;
}

/**
 * What the fake System One model should answer with.
 */
export interface FakeOpenRouterDecisionReply {
  readonly id?: Maybe<string>;
  readonly model?: Maybe<string>;
  readonly provider?: Maybe<string>;
  /**
   * The answers, keyed by question id, in the WIRE shape (`{ type, choice }`, `{ type, noul }`, …).
   *
   * Deliberately untyped: a fixture's job includes producing replies the declaration types forbid, which
   * is how the membership check is exercised at all.
   */
  readonly answers?: Maybe<Record<string, unknown>>;
  readonly inputTokens?: Maybe<number>;
  readonly outputTokens?: Maybe<number>;
  readonly cost?: Maybe<number>;
  /**
   * An HTTP status to answer with instead of a success.
   */
  readonly status?: Maybe<number>;
  /**
   * Thrown instead of answered, for the transport-failure path.
   */
  readonly throws?: Maybe<Error>;
}

/**
 * Decides the reply for one request.
 */
export type FakeOpenRouterDecisionReplyFactory = (request: FakeOpenRouterRequest, callIndex: number) => FakeOpenRouterDecisionReply | Promise<FakeOpenRouterDecisionReply>;

/**
 * A fake OpenRouter client plus the requests it received.
 */
export interface FakeOpenRouterDecisionClient {
  readonly client: OpenRouterCore;
  readonly requests: FakeOpenRouterRequest[];
  readonly callCount: number;
}

/**
 * The model a fake reply reports serving the request.
 *
 * A VERSIONED slug even when the request named an alias, matching what the route really does — which is
 * what lets a spec assert that the served model is read off the response rather than echoed from the
 * request.
 */
export const FAKE_OPENROUTER_DECISION_MODEL = 'typesafe/jev-1.13';

/**
 * Builds a `DecisionsResponse` JSON body in the WIRE shape the SDK's inbound schema parses.
 *
 * Note the snake_case `input_tokens` / `output_tokens`: the SDK decodes those to camelCase, so a fake
 * that helpfully emitted the camelCase names would hide the rename and let a hand-rolled parser pass.
 *
 * @param reply - What the fake model should answer with.
 * @param index - The call ordinal, used to make a distinct generation id when none is given.
 * @returns The response body.
 */
export function fakeOpenRouterDecisionResponseBody(reply: FakeOpenRouterDecisionReply, index: number): Record<string, unknown> {
  return {
    id: reply.id ?? `gen_${index}`,
    model: reply.model ?? FAKE_OPENROUTER_DECISION_MODEL,
    provider: reply.provider ?? 'typesafe',
    answers: reply.answers ?? {},
    usage: {
      input_tokens: reply.inputTokens ?? 100,
      // Non-zero by default, because the real route reports output tokens even though it does not bill
      // for them — a fake defaulting to 0 would let a reader conclude the field is always empty.
      output_tokens: reply.outputTokens ?? 34,
      cost: reply.cost ?? 0.0000042
    }
  };
}

/**
 * Creates a real {@link OpenRouterCore} whose HTTP layer is answered locally.
 *
 * @param replyFactory - Decides the reply per request, or a single fixed reply.
 * @returns The client and its captured requests.
 */
export function fakeOpenRouterDecisionClient(replyFactory: FakeOpenRouterDecisionReplyFactory | FakeOpenRouterDecisionReply): FakeOpenRouterDecisionClient {
  const requests: FakeOpenRouterRequest[] = [];
  const factory: FakeOpenRouterDecisionReplyFactory = typeof replyFactory === 'function' ? replyFactory : () => replyFactory;

  const httpClient = new HTTPClient({
    fetcher: async (input) => {
      const request = input as Request;
      const body = (await request.clone().json()) as Record<string, unknown>;
      const record: FakeOpenRouterRequest = { url: request.url, method: request.method, body };
      const index = requests.length;
      requests.push(record);

      const reply = await factory(record, index);

      if (reply.throws) {
        throw reply.throws;
      }

      const status = reply.status ?? 200;
      const responseBody = status === 200 ? fakeOpenRouterDecisionResponseBody(reply, index) : { error: { code: status, message: `fake failure ${status}` } };

      return new Response(JSON.stringify(responseBody), { status, headers: { 'content-type': 'application/json' } });
    }
  });

  const client = new OpenRouterCore({ apiKey: 'test-key', httpClient, retryConfig: { strategy: 'none' } });

  return {
    client,
    requests,
    get callCount() {
      return requests.length;
    }
  };
}
