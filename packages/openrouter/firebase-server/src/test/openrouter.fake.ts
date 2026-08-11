/**
 * Test doubles for the emulator integration suite.
 *
 * The OpenRouter client faked here is a REAL `OpenRouterCore` wired to a stub `fetcher` rather than a
 * hand-rolled object. That matters: every scenario that asserts something about the outgoing request
 * (a freshly signed url, an echoed annotation, a trace attribute) is then asserting against the JSON
 * OpenRouter would actually receive, after the SDK's own outbound serialization — which is where a
 * field silently gets dropped. A stubbed `callModel` would assert against our own intermediate shape
 * and prove nothing about the wire.
 */

import { HTTPClient } from '@openrouter/sdk';
import { OpenRouterCore } from '@openrouter/sdk/core';
import { type FirebaseStorageContext, type StoragePath } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * A tool call the fake model should emit.
 */
export interface FakeOpenRouterToolCall {
  readonly callId: string;
  readonly name: string;
  readonly arguments?: Maybe<Record<string, unknown>>;
}

/**
 * What the fake model should answer with on one turn.
 */
export interface FakeOpenRouterReply {
  readonly id?: Maybe<string>;
  readonly text?: Maybe<string>;
  readonly toolCalls?: Maybe<FakeOpenRouterToolCall[]>;
  /**
   * A response-level error, which the runner treats as a failed attempt.
   *
   * `code` is a string because OpenRouter's `ResponsesErrorField` models it as one — a numeric HTTP
   * status here fails the SDK's inbound validation and produces a transport error instead of the
   * response-level error the test meant to exercise.
   */
  readonly error?: Maybe<{ readonly code: string; readonly message: string }>;
  /**
   * Cost/usage to report.
   */
  readonly cost?: Maybe<number>;
  /**
   * Milliseconds to stall before answering, for the time-budget and concurrency scenarios.
   */
  readonly delayMs?: Maybe<number>;
  /**
   * Thrown instead of answered, for the transport-failure path.
   */
  readonly throws?: Maybe<Error>;
}

/**
 * Decides the reply for one request. Receives the request body exactly as it went on the wire.
 */
export type FakeOpenRouterReplyFactory = (body: Record<string, unknown>, callIndex: number) => FakeOpenRouterReply | Promise<FakeOpenRouterReply>;

/**
 * A fake OpenRouter client plus the requests it received.
 */
export interface FakeOpenRouterClient {
  readonly client: OpenRouterCore;
  /**
   * Every request body sent, in order, serialized exactly as OpenRouter would have received it.
   */
  readonly requests: Record<string, unknown>[];
  readonly callCount: number;
}

const FAKE_MODEL = 'openai/gpt-5.1';

/**
 * Builds an `OpenResponsesResult` JSON body in the wire (snake_case) shape the SDK's inbound schema
 * parses.
 *
 * @param reply - What the fake model should answer with.
 * @param index - The call ordinal, used to make a distinct generation id when none is given.
 * @returns The response body.
 */
export function fakeOpenRouterResponseBody(reply: FakeOpenRouterReply, index: number): Record<string, unknown> {
  const text = reply.text ?? '';
  const toolCalls = reply.toolCalls ?? [];

  const output: Record<string, unknown>[] = toolCalls.map((call) => ({
    type: 'function_call',
    id: `fc_${call.callId}`,
    call_id: call.callId,
    name: call.name,
    arguments: JSON.stringify(call.arguments ?? {}),
    status: 'completed'
  }));

  // `validateFinalResponse` rejects an empty output array, and a tool-call turn legitimately has no
  // message of its own — so a message item is only added when there is text or nothing else to say.
  if (text !== '' || output.length === 0) {
    output.push({
      type: 'message',
      id: `msg_${index}`,
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text }]
    });
  }

  return {
    // NOTE: no `output_text`. OpenRouter does not send one — verified live against both a streaming and
    // a non-streaming request — so a fake that helpfully supplies it would hide the fact that the text
    // has to be read out of the `message` output item.
    id: reply.id ?? `gen_${index}`,
    object: 'response',
    created_at: 1000 + index,
    completed_at: 1001 + index,
    error: reply.error == null ? null : { code: reply.error.code, message: reply.error.message },
    frequency_penalty: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    model: FAKE_MODEL,
    output,
    parallel_tool_calls: false,
    presence_penalty: null,
    status: 'completed',
    temperature: null,
    tool_choice: 'auto',
    tools: [],
    top_p: null,
    usage: {
      input_tokens: 11,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 7,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 18,
      cost: reply.cost ?? 0.001,
      is_byok: true
    }
  };
}

/**
 * Creates a real {@link OpenRouterCore} whose HTTP layer is answered locally.
 *
 * @param replyFactory - Decides the reply per request, or a single fixed reply.
 * @returns The client and its captured requests.
 */
export function fakeOpenRouterClient(replyFactory: FakeOpenRouterReplyFactory | FakeOpenRouterReply): FakeOpenRouterClient {
  const requests: Record<string, unknown>[] = [];
  const factory: FakeOpenRouterReplyFactory = typeof replyFactory === 'function' ? replyFactory : () => replyFactory;

  const httpClient = new HTTPClient({
    fetcher: async (input) => {
      const request = input as Request;
      const body = (await request.clone().json()) as Record<string, unknown>;
      const index = requests.length;
      requests.push(body);

      const reply = await factory(body, index);

      if (reply.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, reply.delayMs as number));
      }

      if (reply.throws) {
        throw reply.throws;
      }

      return new Response(JSON.stringify(fakeOpenRouterResponseBody(reply, index)), { status: 200, headers: { 'content-type': 'application/json' } });
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

/**
 * A storage context that mints a distinct, timestamped url per call.
 *
 * The emulator's storage cannot mint a real signed url, and a real one would not answer the question
 * the signed-url scenario asks anyway: it asks whether the runner mints a NEW url per attempt, which is
 * observable only by making every mint distinguishable.
 */
export interface FakeStorageContext {
  readonly storageContext: FirebaseStorageContext;
  /**
   * The urls minted so far, in order.
   */
  readonly signed: string[];
  /**
   * Overridable clock, so a test can advance past a signed url's lifetime.
   */
  now: () => number;
}

/**
 * Creates a {@link FakeStorageContext}.
 *
 * @param bucketId - The default bucket id to report.
 * @returns The fake storage context.
 */
export function fakeStorageContext(bucketId = 'test-bucket'): FakeStorageContext {
  const signed: string[] = [];

  const fake: FakeStorageContext = {
    signed,
    now: () => Date.now(),
    storageContext: {
      defaultBucket: () => bucketId,
      file: (path: StoragePath) => ({
        getSignedUrl: async () => {
          const url = `https://storage.example.com/${path.bucketId}/${path.pathString}?issuedAt=${fake.now()}&n=${signed.length}`;
          signed.push(url);
          return url;
        }
      })
    } as unknown as FirebaseStorageContext
  };

  return fake;
}
