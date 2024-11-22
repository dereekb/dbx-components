import { Maybe, ArrayOrValue, IterableOrValue, ObjectKey, mergeObjects, useIterableOrValue, FilterKeyValueTuplesInput } from '@dereekb/util';

/**
 * Options for makeUrlSearchParams()
 */
export interface MakeUrlSearchParamsOptions {
  /**
   * Optional iterable of keys to remove from the search params.
   */
  readonly omitKeys?: Maybe<IterableOrValue<ObjectKey>>;
  /**
   * Optional filter for merging the objects together.
   */
  readonly mergeFilter?: FilterKeyValueTuplesInput;
}

/**
 * Creates URLSearchParams from the input objects. The input objects are merged together.
 *
 * @param input
 * @param omitKeys
 * @returns
 */
export function makeUrlSearchParams(input: Maybe<ArrayOrValue<Maybe<object | Record<string, string | number>>>>, options?: Maybe<MakeUrlSearchParamsOptions>) {
  const { omitKeys } = options ?? {};
  const mergedInput = Array.isArray(input) ? mergeObjects(input) : input;
  const searchParams = new URLSearchParams(mergedInput as unknown as Record<string, string>);

  if (omitKeys != null) {
    useIterableOrValue(omitKeys, (key) => searchParams.delete(key), false);
  }

  return searchParams;
}
