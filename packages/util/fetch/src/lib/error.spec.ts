import { itShouldFail, failDueToSuccess, failSuccessfully } from '@dereekb/util/test';
import { fetchService, type FetchService } from './fetch';
import { FetchResponseError, requireOkResponse } from './error';

const testFetch: FetchService = fetchService({
  makeFetch: fetch as any,
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as any
});

jest.setTimeout(30000);

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
