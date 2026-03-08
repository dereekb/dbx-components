/**
 * Strips query parameters (`?...`) and hash fragments (`#...`) from a URL string, returning only the base URL.
 *
 * Operates via simple string splitting rather than URL parsing, so it works with partial or non-standard URLs.
 *
 * @param url - the full URL string to clean
 *
 * @example
 * ```ts
 * const base = urlWithoutParameters('https://test.com:1234?test=true');
 * // base === 'https://test.com:1234'
 * ```
 */
export function urlWithoutParameters(url: string): string {
  const queryOpenPosition = url.indexOf('?');

  if (queryOpenPosition !== -1) {
    url = url.substring(0, queryOpenPosition);
  }

  const hashOpenPosition = url.indexOf('#');

  if (hashOpenPosition !== -1) {
    url = url.substring(0, hashOpenPosition);
  }

  return url;
}
