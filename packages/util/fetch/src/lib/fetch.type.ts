export type FetchMethod = Request['method'];

export interface RequestTimeoutRef {
  timeout?: number | null;
}

/**
 * RequestInit with timeout provided.
 */
export interface RequestInitWithTimeout extends RequestInit, RequestTimeoutRef {}
export interface RequestWithTimeout extends Request, RequestTimeoutRef {}

export type ConfiguredFetch = typeof fetch;
export type ConfiguredFetchWithTimeout = (input: Parameters<typeof fetch>[0], init?: RequestInitWithTimeout | undefined) => ReturnType<typeof fetch>;
