/**
 * **Fetch-seam fakes** — socket-free stand-ins for `@dereekb/util/fetch`'s `ConfiguredFetch`, the seam every llm network
 * read goes through. A fake records each request (URL, method, headers, body, signal) and answers with a real `Response`,
 * so the code under test reads status, headers and body exactly as it would off the wire. Plain JS: no vitest, no Node API.
 */

import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type ConfiguredFetch, headersToHeadersTuple } from '@dereekb/util/fetch';

/**
 * The init a fake recorded, flattened for assertions: `headers` is a plain record (a plain-object `HeadersInit` keeps its
 * key case), `body` the string as sent.
 */
export interface LlmFetchFakeRequestInit {
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Maybe<string>;
  readonly signal?: Maybe<AbortSignal>;
}

/**
 * One request a fake received.
 */
export interface LlmFetchFakeRequest {
  /**
   * The absolute URL the request was sent to.
   */
  readonly url: WebsiteUrl;
  readonly init: LlmFetchFakeRequestInit;
}

/**
 * What a fake answers one request with.
 */
export interface LlmFetchFakeAnswer {
  /**
   * The HTTP status; default `200`.
   */
  readonly status?: Maybe<number>;
  /**
   * The response body. A string is sent verbatim, `undefined` sends an empty body, anything else is `JSON.stringify`'d.
   */
  readonly body?: unknown;
  /**
   * The response headers.
   */
  readonly headers?: Maybe<Readonly<Record<string, string>>>;
}

/**
 * Answers one request. A throw or rejection is the socket failure the `fetch` rejects with.
 */
export type LlmFetchFakeRespond = (request: LlmFetchFakeRequest) => LlmFetchFakeAnswer | Response | Promise<LlmFetchFakeAnswer | Response>;

/**
 * A fake: its seam and what it received.
 */
export interface LlmFetchFake {
  readonly fetch: ConfiguredFetch;
  /**
   * Every request received, recorded BEFORE the answer is built (so a throwing respond is still recorded).
   */
  readonly requests: LlmFetchFakeRequest[];
}

/**
 * Flatten one `fetch` call into a {@link LlmFetchFakeRequest}.
 *
 * @param input - The `fetch` input.
 * @param init - The `fetch` init.
 * @returns The recorded request.
 */
export function toLlmFetchFakeRequest(input: Parameters<ConfiguredFetch>[0], init?: Maybe<RequestInit>): LlmFetchFakeRequest {
  let url: WebsiteUrl;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  const headers = Object.fromEntries(init?.headers == null ? [] : headersToHeadersTuple(init.headers));
  const body = typeof init?.body === 'string' ? init.body : undefined;
  return { url, init: { method: init?.method ?? 'GET', headers, body, signal: init?.signal ?? undefined } };
}

/**
 * Build the `Response` an answer describes.
 *
 * @param answer - The status, body and headers.
 * @returns The response.
 */
export function llmFetchFakeResponse(answer: LlmFetchFakeAnswer): Response {
  const body = answer.body;
  let text = '';

  if (typeof body === 'string') {
    text = body;
  } else if (body !== undefined) {
    text = JSON.stringify(body);
  }

  return new Response(text, { status: answer.status ?? 200, headers: answer.headers ?? undefined });
}

/**
 * Stands in for a socket that never answers: rejects with the signal's reason once the signal aborts (at once when it
 * already has), exactly like a real `fetch`. With no signal it stays pending.
 *
 * @param signal - The request's signal.
 * @returns Never resolves; rejects with the signal's reason once it aborts.
 */
export function hangLlmFetchFakeUntilAborted(signal: Maybe<AbortSignal>): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
    } else {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    }
  });
}

/**
 * **Build a fetch-seam fake.**.
 *
 * @param respond - One answer for every request, a function called per request, or `'hang'` (never answers; rejects once the request signal aborts).
 * @returns The fake's seam and its recorded requests.
 *
 * @example
 * ```ts
 * const fake = makeLlmFetchFake({ status: 401, body: { error: { message: 'User not found.' } } });
 * await probeLlmCredentialEndpoint({ strategyId: 'openrouter', url: 'https://openrouter.ai/api/v1/key', apiKey, fetch: fake.fetch });
 * fake.requests[0]?.init.headers['Authorization']; // 'Bearer …'
 * ```
 */
export function makeLlmFetchFake(respond: LlmFetchFakeRespond | LlmFetchFakeAnswer | 'hang'): LlmFetchFake {
  const requests: LlmFetchFakeRequest[] = [];

  const fakeFetch: ConfiguredFetch = async (input, init) => {
    const request = toLlmFetchFakeRequest(input, init);
    requests.push(request);
    let response: Response;

    if (respond === 'hang') {
      response = await hangLlmFetchFakeUntilAborted(init?.signal);
    } else {
      const answer = typeof respond === 'function' ? await respond(request) : respond;
      response = answer instanceof Response ? answer : llmFetchFakeResponse(answer);
    }

    return response;
  };

  return { fetch: fakeFetch, requests };
}

/**
 * Read one header a fake recorded, matching the name case-insensitively: a plain-object `HeadersInit` keeps its key case
 * in {@link LlmFetchFakeRequestInit.headers}, a `Headers` instance lower-cases it.
 *
 * @param request - The recorded request.
 * @param name - The header name, any case.
 * @returns The header value, or `undefined` when the request carried none.
 *
 * @example
 * ```ts
 * readLlmFetchFakeHeader(fake.requests[0], 'authorization'); // 'Bearer …'
 * ```
 */
export function readLlmFetchFakeHeader(request: LlmFetchFakeRequest, name: string): Maybe<string> {
  const wanted = name.toLowerCase();
  const entry = Object.entries(request.init.headers).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1];
}
