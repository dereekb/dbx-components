import { type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchMethod } from '@dereekb/util/fetch';
import { type MicrosoftGraphContext } from './graph.config';
import { canonicalizeMicrosoftGraphHeaders, type MicrosoftGraphHeaders } from './graph.header';

/**
 * Query parameters for a Graph request. `undefined`/`null` values are dropped.
 */
export type MicrosoftGraphQuery = Record<string, Maybe<string | number | boolean>>;

export interface MicrosoftGraphRequestInput {
  readonly method: FetchMethod;
  /**
   * A path relative to the Graph base URL (`/me/messages`), or an absolute URL (an `@odata.nextLink`).
   */
  readonly path: string;
  readonly query?: Maybe<MicrosoftGraphQuery>;
  readonly body?: Maybe<FetchJsonBody>;
  /**
   * Extra request headers, e.g. `Prefer` or `ConsistencyLevel`. A header the client sets by default
   * (`Accept`, `Content-Type`) is replaced whatever its casing.
   */
  readonly headers?: Maybe<MicrosoftGraphHeaders>;
}

/**
 * Appends the query to the path, keeping any query the path already carries.
 *
 * @param path - The path or absolute URL.
 * @param query - The query values to append.
 * @returns The path with the query appended.
 */
export function microsoftGraphPathWithQuery(path: string, query: Maybe<MicrosoftGraphQuery>): string {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value != null) {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  let result = path;

  if (queryString) {
    result = `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
  }

  return result;
}

/**
 * Makes a raw Graph call as the context's user.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that performs the request and resolves the parsed JSON body.
 * @throws {MicrosoftGraphError} When Graph returns an error body.
 */
export function microsoftGraphRequest(context: MicrosoftGraphContext): <T = unknown>(input: MicrosoftGraphRequestInput) => Promise<T> {
  return async <T>(input: MicrosoftGraphRequestInput) => {
    const accessToken = await context.accessTokenGetter();

    return context.fetchJson<T>(microsoftGraphPathWithQuery(input.path, input.query), {
      method: input.method,
      body: input.body ?? undefined,
      headers: {
        ...canonicalizeMicrosoftGraphHeaders(input.headers),
        Authorization: `Bearer ${accessToken}`
      }
    });
  };
}
