import { FetchResponseError } from '@dereekb/util/fetch';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logTrelloServerErrorFunction, parseTrelloApiError, TrelloServerError, TrelloInvalidTokenError, TrelloServerFetchResponseError, TrelloTooManyRequestsError } from './trello.error.api';

function makeFetchResponseError(status: number, body: string, headers: Record<string, string> = {}): FetchResponseError {
  const response = new Response(body, { status, headers });
  return new FetchResponseError(response);
}

describe('parseTrelloApiError()', () => {
  it('returns a TrelloInvalidTokenError for 401 responses', async () => {
    const error = makeFetchResponseError(401, 'invalid token');
    const parsed = await parseTrelloApiError(error);

    expect(parsed).toBeInstanceOf(TrelloInvalidTokenError);
    expect(parsed?.status).toBe(401);
    expect(parsed?.data.bodyText).toBe('invalid token');
  });

  it('returns a TrelloTooManyRequestsError for 429 responses', async () => {
    const error = makeFetchResponseError(429, 'API_TOKEN_LIMIT_EXCEEDED', { 'Retry-After': '5' });
    const parsed = await parseTrelloApiError(error);

    expect(parsed).toBeInstanceOf(TrelloTooManyRequestsError);
    expect(parsed?.status).toBe(429);
    expect((parsed as TrelloTooManyRequestsError).retryAfter).toBe(5);
  });

  it('returns a generic TrelloServerFetchResponseError for other error statuses', async () => {
    const error = makeFetchResponseError(500, 'internal server error');
    const parsed = await parseTrelloApiError(error);

    expect(parsed).toBeInstanceOf(TrelloServerFetchResponseError);
    expect(parsed).not.toBeInstanceOf(TrelloInvalidTokenError);
    expect(parsed).not.toBeInstanceOf(TrelloTooManyRequestsError);
    expect(parsed?.status).toBe(500);
  });

  it('parses JSON bodies when the response is JSON', async () => {
    const body = JSON.stringify({ message: 'something broke', code: 12345 });
    const error = makeFetchResponseError(400, body, { 'Content-Type': 'application/json' });
    const parsed = await parseTrelloApiError(error);

    expect(parsed?.data.bodyJson).toEqual({ message: 'something broke', code: 12345 });
  });
});

describe('logTrelloServerErrorFunction()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a fetch response error to stderr, never stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const parsed = await parseTrelloApiError(makeFetchResponseError(401, 'invalid token'));

    logTrelloServerErrorFunction('Test')(parsed as TrelloServerFetchResponseError);

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe('TestError(401): ');
  });

  it('logs a plain server error to stderr, never stdout', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logTrelloServerErrorFunction('Test')(new TrelloServerError('boom', { status: 500, bodyText: 'boom' }));

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe('TestError(status:500): ');
  });
});
