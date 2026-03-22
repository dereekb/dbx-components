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
}

/**
 * Creates URLSearchParams from the input objects. The input objects are merged together.
 *
 * @param input - one or more objects (or nullish values) whose key-value pairs become search parameters
 * @param options - optional configuration for filtering, omitting keys, and space encoding
 * @returns a URLSearchParams instance built from the merged and filtered input
 */
export function makeUrlSearchParams(input: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>) {
  const { omitKeys, filterEmptyValues: filterValues } = options ?? {};
  const mergedInput = Array.isArray(input) ? mergeObjects(input) : input;
  const filteredInput = (filterValues ?? true) ? filterEmptyPojoValues(mergedInput ?? {}) : mergedInput;
  const searchParams = new URLSearchParams(filteredInput as unknown as Record<string, string>);

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
 * @param input - objects to encode as query parameters
 * @param options - encoding options
 * @returns the encoded query string (without a leading `?`)
 */
export function makeUrlSearchParamsString(input: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>): string {
  const params = makeUrlSearchParams(input, options);
  const str = params.toString();
  return options?.useUrlSearchSpaceHandling ? str.replace(/\+/g, '%20') : str;
}

/**
 * Merges an array of MakeUrlSearchParamsOptions into a single MakeUrlSearchParamsOptions value.
 *
 * @param options - one or more options objects whose omitKeys sets are combined
 * @returns a single MakeUrlSearchParamsOptions with the union of all omitKeys
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
