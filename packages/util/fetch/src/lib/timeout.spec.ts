import { itShouldFail, failDueToSuccess, failSuccessfully } from '@dereekb/util/test';
import { fetchService, type FetchService } from './fetch';
import { requireOkResponse } from './error';
import { waitForMs } from '@dereekb/util';
import { FetchTimeoutError } from './timeout';

const testFetch: FetchService = fetchService({
  makeFetch: (url, init) => {
    const req = fetch(url as RequestInfo, init as RequestInit);
    return req.then((x) => waitForMs(100000).then((x) => ({} as Response))); // if successful, just wait
  },
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as any
});

describe('timeoutFetch()', () => {
  const forbiddenUrl = 'https://components.dereekb.com/api/webhook';

  itShouldFail('if the request times out', async () => {
    const fetch = testFetch.makeFetch({
      useTimeout: true,
      timeout: 1 // timeout "instantly"
    });

    const response = fetch(forbiddenUrl, {
      method: 'GET'
    });

    try {
      await requireOkResponse(response);
      failDueToSuccess();
    } catch (e: unknown) {
      expect(e instanceof FetchTimeoutError);
      failSuccessfully();
    }
  });
});
