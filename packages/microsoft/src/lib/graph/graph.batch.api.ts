import { type Maybe, type Milliseconds, MS_IN_SECOND, waitForMs } from '@dereekb/util';
import { type FetchJsonBody, type FetchMethod } from '@dereekb/util/fetch';
import { microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphHeaders } from './graph.header';
import { MICROSOFT_GRAPH_API_URL } from '../microsoft.config';

/**
 * The most requests one `$batch` call may carry.
 *
 * @see https://learn.microsoft.com/en-us/graph/json-batching#batch-size-limitations
 */
export const MICROSOFT_GRAPH_BATCH_MAX_REQUESTS = 20;

/**
 * How many times {@link microsoftGraphBatch} re-sends throttled (429) items by default.
 */
export const DEFAULT_MICROSOFT_GRAPH_BATCH_MAX_RETRIES = 3;

/**
 * The longest `Retry-After`, in seconds, {@link microsoftGraphBatch} waits by default. A longer one ends
 * the retries and the item is returned with its 429.
 */
export const DEFAULT_MICROSOFT_GRAPH_BATCH_MAX_RETRY_AFTER_SECONDS = 60;

/**
 * One request inside a `$batch` call.
 */
export interface MicrosoftGraphBatchRequestItem {
  /**
   * Unique within the batch. Responses are matched back to requests by it.
   */
  readonly id: string;
  readonly method: FetchMethod;
  /**
   * The request URL relative to the Graph version root, e.g. `/me/messages/{id}`. An absolute Graph v1.0
   * URL (an `@odata.nextLink`) is accepted and made relative.
   */
  readonly url: string;
  readonly headers?: Maybe<MicrosoftGraphHeaders>;
  /**
   * A JSON body. It is sent with `Content-Type: application/json` unless `headers` names another.
   */
  readonly body?: Maybe<FetchJsonBody>;
  /**
   * Ids of requests that must succeed first. They must sit in the same chunk of
   * {@link MICROSOFT_GRAPH_BATCH_MAX_REQUESTS}; a request whose dependency fails is answered 424.
   */
  readonly dependsOn?: Maybe<readonly string[]>;
}

/**
 * One response inside a `$batch` answer.
 */
export interface MicrosoftGraphBatchResponseItem<T = unknown> {
  readonly id: string;
  /**
   * The item's own HTTP status. The outer `$batch` call answers 200 even when every item failed.
   */
  readonly status: number;
  readonly headers?: Maybe<MicrosoftGraphHeaders>;
  /**
   * The item's JSON body, or a Graph error body (`{ error: { code, message } }`) when it failed.
   */
  readonly body?: Maybe<T>;
}

export interface MicrosoftGraphBatchInput {
  readonly requests: readonly MicrosoftGraphBatchRequestItem[];
  /**
   * How many times throttled (429) items are re-sent. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_BATCH_MAX_RETRIES}.
   */
  readonly maxRetries?: Maybe<number>;
  /**
   * The longest `Retry-After`, in seconds, worth waiting for. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_BATCH_MAX_RETRY_AFTER_SECONDS}.
   */
  readonly maxRetryAfterSeconds?: Maybe<number>;
  /**
   * Waits between retries. The seam specs use to skip real time. Defaults to {@link waitForMs}.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

export interface MicrosoftGraphBatchResult<T = unknown> {
  /**
   * One response per request, in request order.
   */
  readonly responses: MicrosoftGraphBatchResponseItem<T>[];
  /**
   * How many retry rounds ran across all chunks.
   */
  readonly retryRounds: number;
}

interface MicrosoftGraphBatchWireResponse {
  readonly responses?: Maybe<MicrosoftGraphBatchResponseItem[]>;
}

/**
 * Returns whether a `$batch` item succeeded (a 2xx status).
 *
 * @param item - The batch response item.
 * @returns True for a 2xx status.
 */
export function isMicrosoftGraphBatchResponseOk(item: Pick<MicrosoftGraphBatchResponseItem, 'status'>): boolean {
  return item.status >= 200 && item.status < 300;
}

/**
 * Splits batch requests into chunks of {@link MICROSOFT_GRAPH_BATCH_MAX_REQUESTS}, in order.
 *
 * @param requests - The requests.
 * @returns The chunks.
 * @throws {Error} When an id repeats, or a `dependsOn` names a request outside its chunk.
 */
export function chunkMicrosoftGraphBatchRequests(requests: readonly MicrosoftGraphBatchRequestItem[]): MicrosoftGraphBatchRequestItem[][] {
  const seen = new Set<string>();
  const chunks: MicrosoftGraphBatchRequestItem[][] = [];

  requests.forEach((request, index) => {
    if (seen.has(request.id)) {
      throw new Error(`Graph $batch request id "${request.id}" is used more than once.`);
    }

    seen.add(request.id);

    if (index % MICROSOFT_GRAPH_BATCH_MAX_REQUESTS === 0) {
      chunks.push([]);
    }

    chunks[chunks.length - 1].push(request);
  });

  chunks.forEach((chunk) => {
    const ids = new Set(chunk.map((x) => x.id));

    chunk.forEach((request) => {
      const outside = request.dependsOn?.find((id) => !ids.has(id));

      if (outside != null) {
        throw new Error(`Graph $batch request "${request.id}" depends on "${outside}", which is not in its chunk of ${MICROSOFT_GRAPH_BATCH_MAX_REQUESTS}.`);
      }
    });
  });

  return chunks;
}

function toBatchWireUrl(url: string): string {
  return url.startsWith(MICROSOFT_GRAPH_API_URL) ? url.slice(MICROSOFT_GRAPH_API_URL.length) || '/' : url;
}

function toBatchWireRequest(request: MicrosoftGraphBatchRequestItem, dependsOn: Maybe<readonly string[]>) {
  const hasContentType = Object.keys(request.headers ?? {}).some((name) => name.toLowerCase() === 'content-type');
  const headers = request.body != null && !hasContentType ? { ...request.headers, 'Content-Type': 'application/json' } : request.headers;

  return {
    id: request.id,
    method: request.method,
    url: toBatchWireUrl(request.url),
    ...(headers ? { headers } : {}),
    ...(request.body == null ? {} : { body: request.body }),
    ...(dependsOn?.length ? { dependsOn } : {})
  };
}

function retryAfterSeconds(item: MicrosoftGraphBatchResponseItem, round: number): number {
  const header = Object.entries(item.headers ?? {}).find(([name]) => name.toLowerCase() === 'retry-after')?.[1];
  const parsed = header == null ? Number.NaN : Number(header);
  // no usable Retry-After: back off 1s, 2s, 4s, ...
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2 ** round;
}

/**
 * Sends requests through Graph JSON batching (`POST /$batch`).
 *
 * - Chunks the requests into groups of {@link MICROSOFT_GRAPH_BATCH_MAX_REQUESTS} and sends the chunks one after another. Outlook runs at most 4 requests of a batch at a time server-side, so a chunk is never fanned out further here.
 * - Never reads the outer 200 as success: every item carries its own status (see {@link isMicrosoftGraphBatchResponseOk}).
 * - Re-sends the items answered 429 after the longest `Retry-After` among them, up to `maxRetries` rounds. An item answered 424 because a throttled dependency failed is re-sent with it.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that sends the batch and resolves one response per request, in request order.
 * @throws {Error} When an id repeats, a `dependsOn` crosses a chunk, or Graph's answer omits a request.
 * @throws {MicrosoftGraphError} When the outer `$batch` call itself fails.
 *
 * @see https://learn.microsoft.com/en-us/graph/json-batching
 * @see https://learn.microsoft.com/en-us/graph/throttling-limits#outlook-service-limits
 */
export function microsoftGraphBatch(context: MicrosoftGraphContext): <T = unknown>(input: MicrosoftGraphBatchInput) => Promise<MicrosoftGraphBatchResult<T>> {
  const request = microsoftGraphRequest(context);

  return async <T>(input: MicrosoftGraphBatchInput) => {
    const maxRetries = input.maxRetries ?? DEFAULT_MICROSOFT_GRAPH_BATCH_MAX_RETRIES;
    const maxRetryAfterSeconds = input.maxRetryAfterSeconds ?? DEFAULT_MICROSOFT_GRAPH_BATCH_MAX_RETRY_AFTER_SECONDS;
    const wait = input.wait ?? waitForMs;
    const results = new Map<string, MicrosoftGraphBatchResponseItem>();
    let retryRounds = 0;

    for (const chunk of chunkMicrosoftGraphBatchRequests(input.requests)) {
      let pending = chunk;
      let round = 0;

      while (pending.length > 0) {
        const pendingIds = new Set(pending.map((x) => x.id));
        // a dependency that already succeeded in an earlier round is dropped; one still pending is kept
        const wire = pending.map((x) =>
          toBatchWireRequest(
            x,
            x.dependsOn?.filter((id) => pendingIds.has(id))
          )
        );
        const answer = await request<MicrosoftGraphBatchWireResponse>({ method: 'POST', path: '/$batch', body: { requests: wire } });
        (answer?.responses ?? []).forEach((item) => results.set(item.id, item));

        const retryIds = new Set(pending.filter((x) => results.get(x.id)?.status === 429).map((x) => x.id));
        let added = retryIds.size > 0;

        // re-send a 424 whose failed dependency is being re-sent and whose other dependencies succeeded
        while (added) {
          added = false;

          pending.forEach((x) => {
            if (!retryIds.has(x.id) && results.get(x.id)?.status === 424 && x.dependsOn?.some((id) => retryIds.has(id)) && x.dependsOn.every((id) => retryIds.has(id) || isMicrosoftGraphBatchResponseOk(results.get(id) ?? { status: 0 }))) {
              retryIds.add(x.id);
              added = true;
            }
          });
        }

        const throttled = pending.filter((x) => results.get(x.id)?.status === 429);
        const waitSeconds = Math.max(0, ...throttled.map((x) => retryAfterSeconds(results.get(x.id) as MicrosoftGraphBatchResponseItem, round)));

        if (retryIds.size === 0 || round >= maxRetries || waitSeconds > maxRetryAfterSeconds) {
          pending = [];
        } else {
          await wait(waitSeconds * MS_IN_SECOND);
          pending = pending.filter((x) => retryIds.has(x.id));
          round += 1;
          retryRounds += 1;
        }
      }
    }

    const responses = input.requests.map((x) => {
      const response = results.get(x.id);

      if (!response) {
        throw new Error(`Graph $batch answer has no response for request "${x.id}".`);
      }

      return response as MicrosoftGraphBatchResponseItem<T>;
    });

    return { responses, retryRounds };
  };
}
