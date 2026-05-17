import type { Maybe } from '@dereekb/util';
/**
 * The HTTP method to use for the request.
 *
 * I.E. 'GET', 'POST', 'PUT', 'DELETE', etc.
 */
export type FetchMethod = Request['method'];

export interface RequestTimeoutRef {
  timeout?: Maybe<number>;
}

/**
 * RequestInit with timeout provided.
 */
export interface RequestInitWithTimeout extends RequestInit, RequestTimeoutRef {}
export interface RequestWithTimeout extends Request, RequestTimeoutRef {}

export type ConfiguredFetch = typeof fetch;
export type ConfiguredFetchWithTimeout = (input: Parameters<typeof fetch>[0], init?: Maybe<RequestInitWithTimeout>) => ReturnType<typeof fetch>;
