/**
 * Removes any query parameters and hashbang parameters from the input string.
 *
 * @param url
 * @returns
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
