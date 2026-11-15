import { type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { TRELLO_API_URL } from '../trello.type';
import { type TrelloConfig } from '../trello.config';
import { type LogTrelloServerErrorFunction } from '../trello.error.api';
import { type TrelloRateLimitedFetchHandlerConfig } from '../trello.limit';
import { type TrelloContextRef, trelloFactory } from './trello.factory';

/**
 * One request an api function issued against a {@link FakeTrelloContext}.
 */
export interface FakeTrelloRequest {
  /**
   * HTTP method, upper-cased.
   */
  readonly method: string;
  /**
   * The api path the route table is keyed on — the url's path with the api base (`/1`) stripped, and without its
   * query string.
   */
  readonly path: string;
  /**
   * The parsed query string.
   */
  readonly query: URLSearchParams;
  /**
   * The absolute url the request factory built.
   */
  readonly url: string;
  /**
   * The request's headers, as sent (including `Authorization`).
   */
  readonly headers: Headers;
  /**
   * The request body, parsed as JSON when it was JSON.
   */
  readonly body?: unknown;
  /**
   * The request's abort signal. A route still pending when it aborts is abandoned, and the request rejects with the
   * abort reason, as a real fetch would.
   */
  readonly signal: AbortSignal;
}

/**
 * A route's response: a `Response` (for a non-2xx or a raw body), a function of the request, or any other value,
 * which is serialized as a 200 JSON body.
 */
export type FakeTrelloRoute = unknown;

/**
 * Config for {@link fakeTrelloContext}.
 */
export interface FakeTrelloContextConfig {
  /**
   * Responses keyed by `'<METHOD> <path>'`, e.g. `'GET /cards/card-1'`. The path excludes the api base and the query
   * string. A `*` in the path matches one segment, so a key of `GET /cards/<star>/actions` covers every card. An exact
   * key wins over a wildcard one.
   */
  readonly routes?: Maybe<Readonly<Record<string, FakeTrelloRoute>>>;
  /**
   * Response for a request no route matched. Defaults to a 404, so an unexpected call surfaces as a Trello error
   * rather than as `undefined`.
   */
  readonly fallback?: Maybe<FakeTrelloRoute>;
  /**
   * Credential / api url overrides. Defaults to placeholder key+token credentials; pass `accessToken` or
   * `accessTokenProvider` to exercise the bearer modes instead.
   */
  readonly config?: Maybe<Partial<TrelloConfig>>;
  /**
   * Error logger. Defaults to a no-op so expected failures stay quiet.
   */
  readonly logTrelloServerErrorFunction?: Maybe<LogTrelloServerErrorFunction>;
  /**
   * Whether requests go through the real rate limiter. Defaults to `false` (or `true` when `rateLimiterConfig` is
   * passed): a busy spec is not throttled, and a 429 route is answered and recorded once rather than retried.
   */
  readonly rateLimit?: Maybe<boolean>;
  /**
   * Rate limiter config, when `rateLimit` is on.
   */
  readonly rateLimiterConfig?: Maybe<TrelloRateLimitedFetchHandlerConfig>;
}

/**
 * A {@link TrelloContextRef} plus the log of every request made through it.
 */
export interface FakeTrelloContext extends TrelloContextRef {
  /**
   * Every request issued, in order.
   */
  readonly requests: readonly FakeTrelloRequest[];
}

/**
 * Builds a Trello context backed by a route table instead of the network.
 *
 * `@dereekb/trello` exposes its seam at the fetch boundary — every api function is `fn(context)(input)` and every one
 * of them lands on `context.fetch` / `context.fetchJson`. So the fake replaces the transport, not a client interface:
 * the context comes from the real {@link trelloFactory} with a `fetchHandler` standing in for the network, so the auth
 * header, the ok-response check, the timeout and the typed-error translation (a 401 becomes a
 * `TrelloInvalidTokenError`) are all the real thing. The rate limiter is off unless `rateLimit` is passed, so a spec is
 * never throttled and a 429 is not retried. Framework-free, so any test runner can use it.
 *
 * @param config - The route table, the optional fallback, and credential overrides.
 * @returns The fake context plus the recorded request log.
 *
 * @example
 * ```ts
 * const fake = fakeTrelloContext({ routes: { 'GET /cards/card-1': { id: 'card-1', name: 'A card' } } });
 * const card = await getCard(fake.trelloContext)({ cardId: 'card-1' });
 * expect(fake.requests[0]?.method).toBe('GET');
 * ```
 */
export function fakeTrelloContext(config: FakeTrelloContextConfig = {}): FakeTrelloContext {
  const requests: FakeTrelloRequest[] = [];
  const routes = config.routes ?? {};
  const overrides = config.config ?? {};
  const usesBearer = overrides.accessToken != null || overrides.accessTokenProvider != null;
  const trelloConfig = (usesBearer ? overrides : { apiKey: 'fake-key', apiToken: 'fake-token', ...overrides }) as TrelloConfig;
  const apiUrl = trelloConfig.apiUrl ?? TRELLO_API_URL;
  const basePath = new URL(apiUrl).pathname.replace(/\/+$/, '');

  const fetchHandler: FetchHandler = async (request) => {
    const url = new URL(request.url);
    const bodyText = request.body == null ? undefined : await request.clone().text();
    let body: unknown;

    try {
      body = bodyText == null || bodyText.length === 0 ? undefined : JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }

    const recorded: FakeTrelloRequest = {
      method: request.method.toUpperCase(),
      path: url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : url.pathname,
      query: url.searchParams,
      url: request.url,
      headers: request.headers,
      body,
      signal: request.signal
    };

    requests.push(recorded);

    const key = `${recorded.method} ${recorded.path}`;
    const matchedKey = Object.hasOwn(routes, key) ? key : Object.keys(routes).find((candidate) => candidate.includes('*') && fakeTrelloRouteRegex(candidate).test(key));
    let response: Response;

    if (matchedKey == null && config.fallback == null) {
      response = new Response(`fakeTrelloContext: no route for "${key}"`, { status: 404 });
    } else {
      const route = matchedKey == null ? config.fallback : routes[matchedKey];
      const value = typeof route === 'function' ? await abortableTrelloRoute(Promise.resolve((route as (request: FakeTrelloRequest) => unknown)(recorded)), request.signal) : route;
      response = value instanceof Response ? value : new Response(JSON.stringify(value ?? null), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return response;
  };

  const rateLimit = config.rateLimit ?? config.rateLimiterConfig != null;
  const { trelloContext } = trelloFactory({ fetchHandler, rateLimit, rateLimiterConfig: config.rateLimiterConfig, logTrelloServerErrorFunction: config.logTrelloServerErrorFunction ?? (() => undefined) })(trelloConfig);
  return { trelloContext, requests };
}

/**
 * Settles with the route's value, or rejects with the abort reason once the request's signal aborts.
 *
 * @param value - The route's pending value.
 * @param signal - The request's abort signal.
 * @returns The route's value, unless the request aborted first.
 */
function abortableTrelloRoute(value: Promise<unknown>, signal: AbortSignal): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);

    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
      value.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    }
  });
}

/**
 * Compiles a wildcard route key into a matcher, where `*` covers one path segment.
 *
 * @param key - The route key, e.g. `GET /cards/<star>/actions`.
 * @returns The matcher for a recorded request's `'<METHOD> <path>'`.
 */
function fakeTrelloRouteRegex(key: string): RegExp {
  return new RegExp(`^${key.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`).replaceAll('*', '[^/]+')}$`);
}
