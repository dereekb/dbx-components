import { type Maybe, type ArrayOrValue, type IterableOrValue, type ObjectKey, mergeObjects, useIterableOrValue, filterEmptyPojoValues, filterEmptyValues } from '@dereekb/util';

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
   * Whether to filter out null and undefined empty values from the input objects.
   *
   * Defaults to true.
   *
   * @deprecated Use filterEmptyValues instead.
   */
  readonly filterNullAndUndefinedValues?: boolean;
}

/**
 * Creates URLSearchParams from the input objects. The input objects are merged together.
 *
 * @param input
 * @param omitKeys
 * @returns
 */
export function makeUrlSearchParams(input: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>) {
  const { omitKeys, filterNullAndUndefinedValues, filterEmptyValues: filterValues = filterNullAndUndefinedValues ?? true } = options ?? {};
  const mergedInput = Array.isArray(input) ? mergeObjects(input) : input;
  const filteredInput = filterValues ? filterEmptyPojoValues(mergedInput ?? {}) : mergedInput;
  const searchParams = new URLSearchParams(filteredInput as unknown as Record<string, string>);

  if (omitKeys != null) {
    useIterableOrValue(omitKeys, (key) => searchParams.delete(key), false);
  }

  return searchParams;
}

/**
 * Merges an array of MakeUrlSearchParamsOptions into a single MakeUrlSearchParamsOptions value.
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
