import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type FetchMethod, type RequestInitWithTimeout } from '@dereekb/util/fetch';
import { type MicrosoftGraphQuery, microsoftGraphPathWithQuery } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { canonicalizeMicrosoftGraphHeaders, type MicrosoftGraphHeaders } from './graph.header';

/**
 * A body sent as-is by {@link microsoftGraphRequestRaw}: file bytes, MIME text, or pre-serialised JSON.
 */
export type MicrosoftGraphRawRequestBody = string | Uint8Array | ArrayBuffer | Blob;

/**
 * The `Content-Type` a raw request with a body goes out with when the caller names none.
 */
export const DEFAULT_MICROSOFT_GRAPH_RAW_CONTENT_TYPE = 'application/octet-stream';

export interface MicrosoftGraphRawRequestInput {
  readonly method: FetchMethod;
  /**
   * A path relative to the Graph base URL (`/me/drive/items/{id}/content`), or an absolute URL (an
   * upload session URL, a copy monitor URL, an `@odata.nextLink`).
   */
  readonly path: string;
  readonly query?: Maybe<MicrosoftGraphQuery>;
  /**
   * Extra request headers. A header the client sets by default (`Accept`, `Content-Type`) is replaced
   * whatever its casing.
   */
  readonly headers?: Maybe<MicrosoftGraphHeaders>;
  /**
   * Sent as-is, never JSON-serialised.
   */
  readonly body?: Maybe<MicrosoftGraphRawRequestBody>;
  /**
   * The body's `Content-Type`. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_RAW_CONTENT_TYPE} when a body
   * is given; a `Content-Type` in `headers` wins over both.
   */
  readonly contentType?: Maybe<string>;
  /**
   * False sends no `Authorization` header. An upload session's chunk PUTs must go without one: the
   * session URL is pre-authenticated, and a bearer token on it is rejected.
   *
   * Defaults to true.
   *
   * @see https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession#remarks
   */
  readonly authorize?: Maybe<boolean>;
  /**
   * Overrides the client's 30-second timeout, e.g. for a large download or chunk upload.
   */
  readonly timeout?: Maybe<Milliseconds>;
}

/**
 * A Graph response read without parsing: status, headers, and the body bytes.
 */
export interface MicrosoftGraphRawResponse {
  readonly status: number;
  /**
   * Response headers, names lower-cased (`location`, `content-type`, `retry-after`).
   */
  readonly headers: MicrosoftGraphHeaders;
  readonly body: Uint8Array;
  /**
   * Decodes the body as UTF-8.
   */
  text(): string;
  /**
   * Parses the body as JSON. Returns undefined for an empty or non-JSON body.
   */
  json<T = unknown>(): Maybe<T>;
}

/**
 * Makes a Graph call and returns the response without JSON-parsing it: the status, the headers, and the
 * body as bytes. For the calls the JSON client cannot represent:.
 *
 * - a `/content` download, which answers 302 to a pre-authenticated URL that fetch follows to the bytes;
 * - a `202 Accepted` whose `Location` header is the result (a drive item copy's monitor URL);
 * - a message's MIME (`/$value`);
 * - an upload with a non-JSON body.
 *
 * A non-2xx response still throws a `MicrosoftGraphError` (or a `FetchResponseError` when the body is not
 * a Graph error), the same as {@link microsoftGraphRequest}.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that performs the request and resolves the raw response.
 *
 * @example
 * ```ts
 * const response = await microsoftGraphRequestRaw(graphContext)({ method: 'GET', path: `/me/drive/items/${id}/content` });
 * await writeFile(out, response.body);
 * ```
 */
export function microsoftGraphRequestRaw(context: MicrosoftGraphContext): (input: MicrosoftGraphRawRequestInput) => Promise<MicrosoftGraphRawResponse> {
  return async (input) => {
    const authorization: MicrosoftGraphHeaders = input.authorize === false ? {} : { Authorization: `Bearer ${await context.accessTokenGetter()}` };
    const contentType: MicrosoftGraphHeaders = input.body == null ? {} : { 'Content-Type': input.contentType ?? DEFAULT_MICROSOFT_GRAPH_RAW_CONTENT_TYPE };

    const init: RequestInitWithTimeout = {
      method: input.method,
      // a Uint8Array over a shared/Node buffer (ArrayBufferLike) is a valid fetch body at runtime; TS's DOM
      // BodyInit only names ArrayBuffer-backed views
      body: (input.body ?? undefined) as Maybe<BodyInit>,
      headers: {
        ...contentType,
        ...canonicalizeMicrosoftGraphHeaders(input.headers),
        ...authorization
      },
      ...(input.timeout == null ? {} : { timeout: input.timeout })
    };

    const response = await context.fetch(microsoftGraphPathWithQuery(input.path, input.query), init);
    const body = new Uint8Array(await response.arrayBuffer());
    const headers: MicrosoftGraphHeaders = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });

    return {
      status: response.status,
      headers,
      body,
      text: () => new TextDecoder().decode(body),
      json: <T>() => {
        let result: Maybe<T>;

        if (body.length > 0) {
          try {
            result = JSON.parse(new TextDecoder().decode(body)) as T;
          } catch {
            result = undefined;
          }
        }

        return result;
      }
    };
  };
}
