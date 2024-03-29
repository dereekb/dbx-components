import { objectToMap } from '@dereekb/util';
import { fetchURL, type FetchURLQueryKeyValueStringTuple, type FetchURLQueryKeyValueTuple, isURL, isURLSearchParams } from './url';

const urlString = 'https://components.dereekb.com/';
const url = new URL(urlString);

const queryKey = 'hello';
const queryParamsTuples: FetchURLQueryKeyValueStringTuple[] = [
  [queryKey, 'world'],
  [queryKey, 'word'],
  ['henlo', 'wrold']
];
const queryParams = new URLSearchParams(queryParamsTuples);

describe('isURL()', () => {
  it('should return true for a URL instance.', () => {
    const result = isURL(url);
    expect(result).toBe(true);
  });
  it('should return false for a string.', () => {
    const result = isURL(urlString);
    expect(result).toBe(false);
  });
});

describe('isURLSearchParams()', () => {
  it('should return true for a URLSearchParams instance.', () => {
    const result = isURLSearchParams(queryParams);
    expect(result).toBe(true);
  });
  it('should return false for a url string.', () => {
    const result = isURLSearchParams(urlString);
    expect(result).toBe(false);
  });
  it('should return false for a tuple.', () => {
    const result = isURLSearchParams(queryParamsTuples);
    expect(result).toBe(false);
  });
});

describe('fetchURL()', () => {
  describe('with string url', () => {
    it('should return the url', () => {
      const result = fetchURL(urlString);
      expect(result).toBe(urlString);
    });
  });

  describe('with URL', () => {
    it('should return the url', () => {
      const result = fetchURL(url);
      expect(result).toBe(url.href);
    });
  });

  describe('with FetchURLConfiguration input', () => {
    it('should return the url', () => {
      const result = fetchURL({ url });
      expect(result).toBe(url.href);
    });

    it('should return the url with query params attached', () => {
      const result = fetchURL({ url, queryParams });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as an object', () => {
      const queryParamsObject = {
        hello: 'world',
        henlo: 'wrold'
      };
      const expectedParams = objectToMap(queryParamsObject);
      const result = fetchURL({ url, queryParams: queryParamsObject });
      expect(result).toBe(url.href + `?${new URLSearchParams(Array.from(expectedParams.entries())).toString()}`);
    });

    it('should not append an empty query to the url.', () => {
      const queryParamsObject = {
        hello: null
      };
      const result = fetchURL({ url, queryParams: queryParamsObject });
      expect(result).toBe(url.href);
    });

    it('should return the url with query params of different types attached as an object', () => {
      const queryParamsObject = {
        1: 'test',
        henlo: 1,
        wrold: true
      };
      const expectedParams = objectToMap(queryParamsObject);
      const result = fetchURL({ url, queryParams: queryParamsObject });
      expect(result).toBe(url.href + `?${new URLSearchParams(Array.from(expectedParams.entries()).map((x) => [String(x[0]), String(x[1])])).toString()}`);
    });

    it('should return the url with query params of different types attached as an object with an array as a set of values for a key', () => {
      const queryParamsObject = {
        [queryKey]: [queryParamsTuples[0][1], queryParamsTuples[1][1]],
        henlo: 'wrold'
      };

      const result = fetchURL({ url, queryParams: queryParamsObject });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params of different types attached as an object and ignore null values', () => {
      const queryParamsObject = {
        [queryKey]: [queryParamsTuples[0][1], queryParamsTuples[1][1]],
        henlo: 'wrold',
        remove: null,
        ignored: undefined
      };

      const result = fetchURL({ url, queryParams: queryParamsObject });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as a tuple', () => {
      const result = fetchURL({ url, queryParams: queryParamsTuples });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as a tuple with an array of values', () => {
      const result = fetchURL({ url, queryParams: queryParamsTuples });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as a Map', () => {
      const expectedParams = new Map(queryParamsTuples);
      const result = fetchURL({ url, queryParams: expectedParams });
      expect(result).toBe(url.href + `?${new URLSearchParams(Array.from(expectedParams.entries())).toString()}`);
    });

    it('should return the url with query params attached as a tuples array', () => {
      // same as queryParamsTuples but has the two values in an array instead of separate
      const queryParamsTuplesWithArray: FetchURLQueryKeyValueTuple[] = [
        [queryKey, [queryParamsTuples[0][1], queryParamsTuples[1][1]]],
        ['henlo', 'wrold']
      ];

      const result = fetchURL({ url, queryParams: queryParamsTuplesWithArray });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as a tuples array undefined keys and values', () => {
      // same as queryParamsTuples but has the two values in an array instead of separate
      const queryParamsTuplesWithArray: FetchURLQueryKeyValueTuple[] = [
        [queryKey, [queryParamsTuples[0][1], queryParamsTuples[1][1], null, undefined]],
        ['henlo', 'wrold'],
        [null, 'removed']
      ];

      const result = fetchURL({ url, queryParams: queryParamsTuplesWithArray });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as a string with a "?" attached', () => {
      const result = fetchURL({ url, queryParams: `?${queryParams.toString()}` });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });

    it('should return the url with query params attached as a string without a "?" attached', () => {
      const result = fetchURL({ url, queryParams: `${queryParams.toString()}` });
      expect(result).toBe(url.href + `?${queryParams.toString()}`);
    });
  });
});
