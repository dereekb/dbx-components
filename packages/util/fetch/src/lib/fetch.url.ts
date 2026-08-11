import { type Maybe, type ArrayOrValue, type IterableOrValue, type ObjectKey, mergeObjects, useIterableOrValue, filterEmptyPojoValues } from '@dereekb/util';

/**
 * Options for makeUrlSearchParams()
 */
export interface MakeUrlSearchParamsOptions {
  /**
   * Optional iterable of keys to remove from the search params.
   */
  readonly omitKeys?: Maybe<IterableOrValue<ObjectKey>>;
  /**
   * Whether to filter out empty values from the input objects.
   *
   * Defaults to true.
   */
  readonly filterEmptyValues?: boolean;
  /**
   * Whether to encode spaces as `%20` instead of `+` in the output string.
   *
   * `URLSearchParams.toString()` uses `application/x-www-form-urlencoded` encoding,
   * which represents spaces as `+`. However, `URL.search` and `decodeURIComponent()`
   * encode spaces as `%20`. This mismatch means that consumers like Angular's router
   * that use `decodeURIComponent()` will not decode `+` back to a space, corrupting
   * values (e.g., `"openid profile"` becomes `"openid+profile"`).
   *
   * Set to `true` when building redirect URLs or any URL that will be decoded with
   * `decodeURIComponent()` rather than form-data parsing.
   *
   * Defaults to false.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#interaction_with_url.searchparams | MDN: Interaction with URL.searchParams}
   */
  readonly useUrlSearchSpaceHandling?: boolean;
  /**
   * Whether to expand nested arrays and objects into bracket-notation keys instead of
   * letting `URLSearchParams` stringify them.
   *
   * `URLSearchParams` calls `String()` on every value, so by default an array is comma-joined
   * and a nested object collapses to the useless `[object Object]`. Many APIs instead expect
   * each leaf addressed by an indexed/keyed path:
   *
   * `{ a: [{ b: 1 }] }` becomes `a[0][b]=1` rather than `a=[object Object]`.
   *
   * Scalar values are unaffected. Nullish leaves are skipped.
   *
   * Defaults to false.
   */
  readonly useBracketNotation?: boolean;
}

/**
 * A single URL query parameter, as a key/value tuple.
 */
export type UrlSearchParamsKeyValueTuple = [string, string];

/**
 * Expands a potentially nested object into bracket-notation query key/value tuples.
 *
 * Arrays are addressed by index and object properties by key, recursively, so every leaf
 * gets its own fully-qualified parameter. Nullish leaves are omitted rather than emitted
 * as the strings `"null"`/`"undefined"`; all other leaves are stringified.
 *
 * @param input - The object to expand.
 * @returns The bracket-notation key/value tuples.
 *
 * @example
 * ```typescript
 * toBracketNotationSearchParamTuples({ calendarsToLoad: [{ credentialId: 1, externalId: 'a@b.com' }] });
 * // => [['calendarsToLoad[0][credentialId]', '1'], ['calendarsToLoad[0][externalId]', 'a@b.com']]
 * ```
 */
export function toBracketNotationSearchParamTuples(input: Maybe<object>): UrlSearchParamsKeyValueTuple[] {
  const tuples: UrlSearchParamsKeyValueTuple[] = [];

  function expandValue(key: string, value: unknown): void {
    if (value != null) {
      if (Array.isArray(value)) {
        value.forEach((itemValue, i) => expandValue(`${key}[${i}]`, itemValue));
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([childKey, childValue]) => expandValue(`${key}[${childKey}]`, childValue));
      } else {
        tuples.push([key, String(value)]);
      }
    }
  }

  Object.entries(input ?? {}).forEach(([key, value]) => expandValue(key, value));

  return tuples;
}

/**
 * Creates URLSearchParams from the input objects. The input objects are merged together.
 *
 * @param input - One or more objects (or nullish values) whose key-value pairs become search parameters.
 * @param options - Optional configuration for filtering, omitting keys, and space encoding.
 * @returns A URLSearchParams instance built from the merged and filtered input.
 */
export function makeUrlSearchParams(input: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>) {
  const { omitKeys, filterEmptyValues: filterValues, useBracketNotation } = options ?? {};
  const mergedInput = Array.isArray(input) ? mergeObjects(input) : input;
  const filteredInput = (filterValues ?? true) ? filterEmptyPojoValues(mergedInput ?? {}) : mergedInput;
  const searchParams = useBracketNotation ? new URLSearchParams(toBracketNotationSearchParamTuples(filteredInput)) : new URLSearchParams(filteredInput as unknown as Record<string, string>);

  if (omitKeys != null) {
    useIterableOrValue(omitKeys, (key) => searchParams.delete(key), false);
  }

  return searchParams;
}

/**
 * Creates a URL query string from the input objects.
 *
 * Equivalent to `makeUrlSearchParams(...).toString()`, but respects the
 * {@link MakeUrlSearchParamsOptions.usePercentEncoding} option to produce
 * RFC 3986 percent-encoded output (`%20` for spaces) instead of the
 * `application/x-www-form-urlencoded` default (`+` for spaces).
 *
 * @param input - Objects to encode as query parameters.
 * @param options - Encoding options.
 * @returns The encoded query string (without a leading `?`)
 */
export function makeUrlSearchParamsString(input: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>): string {
  const params = makeUrlSearchParams(input, options);
  const str = params.toString();
  return options?.useUrlSearchSpaceHandling ? str.replaceAll('+', '%20') : str;
}

/**
 * Updates or adds query parameters on an existing URL string.
 *
 * Parses the URL's existing query string, merges in the new parameters (new values
 * override existing keys), and returns the rebuilt URL. Respects all
 * {@link MakeUrlSearchParamsOptions} such as `omitKeys`, `filterEmptyValues`, and
 * `useUrlSearchSpaceHandling`.
 *
 * @param url - The URL string to update.
 * @param params - New search parameters to merge into the URL.
 * @param options - Optional configuration for filtering, omitting keys, and space encoding.
 * @returns The URL string with updated query parameters.
 *
 * @example
 * ```typescript
 * // Add params to a URL with no query string
 * updateUrlSearchParams('https://example.com/form', { name: 'Alice', age: 30 });
 * // => 'https://example.com/form?name=Alice&age=30'
 *
 * // Override an existing param
 * updateUrlSearchParams('https://example.com?page=1&sort=asc', { page: 2 });
 * // => 'https://example.com?page=2&sort=asc'
 *
 * // Use percent-encoded spaces for redirect URLs
 * updateUrlSearchParams('https://example.com', { scope: 'openid profile' }, { useUrlSearchSpaceHandling: true });
 * // => 'https://example.com?scope=openid%20profile'
 * ```
 */
export function updateUrlSearchParams(url: string, params: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>): string {
  const [basePath, existingQuery] = url.split('?', 2);
  const existingParams = existingQuery ? new URLSearchParams(existingQuery) : new URLSearchParams();
  const newParams = makeUrlSearchParams(params, options);

  // Merge: new params override existing
  for (const [key, value] of newParams.entries()) {
    existingParams.set(key, value);
  }

  // Apply omitKeys to the merged result
  if (options?.omitKeys != null) {
    useIterableOrValue(options.omitKeys, (key) => existingParams.delete(key), false);
  }

  let queryString = existingParams.toString();

  if (options?.useUrlSearchSpaceHandling) {
    queryString = queryString.replaceAll('+', '%20');
  }

  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Merges an array of MakeUrlSearchParamsOptions into a single MakeUrlSearchParamsOptions value.
 *
 * @param options - One or more options objects whose omitKeys sets are combined.
 * @returns A single MakeUrlSearchParamsOptions with the union of all omitKeys.
 */
export function mergeMakeUrlSearchParamsOptions(options: ArrayOrValue<Maybe<MakeUrlSearchParamsOptions>>): MakeUrlSearchParamsOptions {
  const omitKeys = new Set<ObjectKey>();

  useIterableOrValue(options, (x) => {
    if (x?.omitKeys != null) {
      useIterableOrValue(x.omitKeys, (key) => omitKeys.add(key));
    }
  });

  return {
    omitKeys: omitKeys.size > 0 ? Array.from(omitKeys) : undefined
  };
}
