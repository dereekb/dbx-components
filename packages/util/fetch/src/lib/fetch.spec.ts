import { itShouldFail, expectFail } from '@dereekb/util/test';
import { FetchService, mergeRequestHeaders, mergeRequestInits } from './fetch';
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
        describe('base url as domain and path', () => {
          describe('with slash at end', () => {
            const baseUrl = 'https://components.dereekb.com/api/';

            const factory = testFetch.fetchRequestFactory({
              baseUrl
            });

            describe('url input as string', () => {
              it('should append the base url with the path to the request.', () => {
                const result = factory('test');
                expect(result.url).toBe(`${baseUrl}test`);
              });
            });
          });

          describe('without slash at end', () => {
            const baseUrl = 'https://components.dereekb.com/api';

            const factory = testFetch.fetchRequestFactory({
              baseUrl
            });

            describe('url input as string', () => {
              it('should append the base url with the path to the request.', () => {
                const result = factory('test');
                expect(result.url).toBe(`${baseUrl}/test`);
              });
            });
          });
        });

        describe('base url as domain', () => {
          const baseUrl = 'https://components.dereekb.com/';

          const factory = testFetch.fetchRequestFactory({
            baseUrl
          });

          describe('url input as string', () => {
            it('should retain the path of an input request if it begins with http(s).', () => {
              const expectedUrl = 'https://google.com/';
              const request = testFetch.makeRequest(expectedUrl);
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

          describe('url input as URL', () => {
            it('should use the URL as is, and ignore the baseUrl.', () => {
              const expectedUrl = 'https://google.com/';
              const request = new URL(expectedUrl);
              const result = factory(request);
              expect(result.url).toBe(expectedUrl);
            });
          });
        });
      });
    });
  });
});

describe('mergeRequestInits()', () => {
  it('should merge the headers', () => {
    const a: HeadersInit = {
      a: '1'
    };

    const b: HeadersInit = {
      b: '1'
    };

    const result = mergeRequestInits({ headers: a }, { headers: b });
    const headers = result.headers as unknown as [string, string][];

    expect(headers.length).toBe(2);
    expect(headers[0][1]).toBe('1');
    expect(headers[1][1]).toBe('1');
    expect(headers.map((x) => x[0])).toContain('a');
    expect(headers.map((x) => x[0])).toContain('b');
  });

  it('should overwrite the headers', () => {
    const a: HeadersInit = {
      a: '1'
    };

    const b: HeadersInit = {
      a: '2'
    };

    const result = mergeRequestInits({ headers: a }, { headers: b });
    const headers = result.headers as unknown as [string, string][];

    expect(headers.length).toBe(1);
    expect(headers[0][0]).toBe('a');
    expect(headers[0][1]).toBe(b.a);
  });
});

describe('mergeRequestHeaders()', () => {
  it('should merge two header objects', () => {
    const a: HeadersInit = {
      a: '1'
    };

    const b: HeadersInit = {
      b: '1'
    };

    const result = mergeRequestHeaders([a, b]);

    expect(result.length).toBe(2);
    expect(result[0][1]).toBe('1');
    expect(result[1][1]).toBe('1');
    expect(result.map((x) => x[0])).toContain('a');
    expect(result.map((x) => x[0])).toContain('b');
  });

  it('should merge overwrite the header values that have the same key', () => {
    const a: HeadersInit = {
      a: '1'
    };

    const b: HeadersInit = {
      a: '2'
    };

    const result = mergeRequestHeaders([a, b]);

    expect(result.length).toBe(1);
    expect(result[0][0]).toBe('a');
    expect(result[0][1]).toBe(b.a);
  });

  it('should merge two header tuples', () => {
    const a: HeadersInit = [['a', '1']];
    const b: HeadersInit = [['b', '1']];

    const result = mergeRequestHeaders([a, b]);

    expect(result.length).toBe(2);
    expect(result.map((x) => x[0])).toContain('a');
    expect(result.map((x) => x[0])).toContain('b');
    expect(result[0][1]).toBe('1');
    expect(result[1][1]).toBe('1');
  });

  it('should overwrite two header tuples', () => {
    const a: HeadersInit = [['a', '1']];
    const b: HeadersInit = [
      ['a', '2'],
      ['b', '1']
    ];

    const result = mergeRequestHeaders([a, b]);

    expect(result.length).toBe(2);
    const ra = result.find((x) => x[0] === 'a') as [string, string];
    expect(ra[0]).toBe('a');
    expect(ra[1]).toBe('2');
  });

  it('should overwrite two header tuples', () => {
    const a: HeadersInit = [['a', '1']];
    const b: HeadersInit = {
      a: '2',
      b: '1'
    };

    const result = mergeRequestHeaders([a, b]);

    expect(result.length).toBe(2);
    const ra = result.find((x) => x[0] === 'a') as [string, string];
    expect(ra[0]).toBe('a');
    expect(ra[1]).toBe('2');
  });

  it('should remove headers with empty values', () => {
    const a: HeadersInit = [['a', '1']];
    const b: HeadersInit = {
      a: '',
      b: '1'
    };

    const result = mergeRequestHeaders([a, b]);

    expect(result.length).toBe(1);
    const ra = result.find((x) => x[0] === 'a');
    expect(ra).toBe(undefined);
  });
});
