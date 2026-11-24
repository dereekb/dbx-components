import { itShouldFail, failDueToSuccess, failSuccessfully } from '@dereekb/util/test';
import { fetchRequestFactory, fetchService, type FetchService } from './fetch';
import { FetchRequestFactoryError, FetchResponseError, requireOkResponse } from './error';

const testFetch: FetchService = fetchService({
  makeFetch: fetch,
  makeRequest: (x, y) => new Request(x, y as RequestInit)
});

describe('requireOkResponse()', () => {
  const forbiddenUrl = 'https://components.dereekb.com/api/webhook';

  itShouldFail('if the request fails.', async () => {
    const fetch = testFetch.makeFetch();
    const response = fetch(forbiddenUrl, {
      method: 'GET'
    });

    try {
      await requireOkResponse(response);
      failDueToSuccess();
    } catch (e: unknown) {
      expect(e instanceof FetchResponseError);
      failSuccessfully();
    }
  });
});

describe('FetchRequestFactoryError', () => {
  it('should not throw for a null cause', () => {
    const error = new FetchRequestFactoryError(null);
    expect(error.message.endsWith(': null')).toBe(true);
    expect(error.error).toBeNull();
  });

  it('should keep the message of an Error cause', () => {
    const error = new FetchRequestFactoryError(new Error('x'));
    expect(error.message.endsWith(': x')).toBe(true);
  });

  it('should be thrown by a fetchRequestFactory whose baseRequest throws null', async () => {
    const factory = fetchRequestFactory({
      baseUrl: 'https://example.com',
      baseRequest: async () => {
        throw null;
      }
    });

    await expect(factory('/a')).rejects.toBeInstanceOf(FetchRequestFactoryError);
  });
});
