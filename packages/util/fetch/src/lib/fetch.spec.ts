import { itShouldFail, expectFail } from '@dereekb/util/test';
import { fetchService, FetchService } from './fetch';
import { nodeFetchService } from './provider';

// TEMP: Fetch global is not available in jest? Use node-fetch@2 for now.

const testFetch: FetchService = nodeFetchService;

jest.setTimeout(30000);

describe('fetchService()', () => {
  it('should have the defined service items.', () => {
    expect(testFetch.fetchRequestFactory).toBeDefined();
    expect(testFetch.makeFetch).toBeDefined();
    expect(testFetch.makeRequest).toBeDefined();
  });
});

describe('fetchRequestFactory()', () => {
  describe('function', () => {
    describe('with baseUrl', () => {
      describe('invalid', () => {
        itShouldFail('when creating a factory with an invalid base url', () => {
          const baseUrl = 'invalidurl';

          expectFail(() =>
            testFetch.fetchRequestFactory({
              baseUrl
            })
          );
        });
      });

      describe('valid', () => {
        const baseUrl = 'https://components.dereekb.com/';

        const factory = testFetch.fetchRequestFactory({
          baseUrl
        });

        it('should retain the path of an input request.', () => {
          const expectedUrl = 'https://google.com/';
          const request = testFetch.makeRequest(expectedUrl);
          const result = factory(request);
          expect(result.url).toBe(expectedUrl);
        });

        it('should retain the path of an input URL.', () => {
          const expectedUrl = 'https://google.com/';
          const request = new URL(expectedUrl);
          const result = factory(request);
          expect(result.url).toBe(expectedUrl);
        });

        it('should append the base url to the request.', () => {
          const result = factory('test');
          expect(result.url).toBe('https://components.dereekb.com/test');
        });

        it('should append the base url to the request if it has a front slash.', () => {
          const result = factory('/test');
          expect(result.url).toBe('https://components.dereekb.com/test');
        });
      });
    });
  });
});
