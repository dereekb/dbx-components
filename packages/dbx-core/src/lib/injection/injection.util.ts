import { StaticProvider } from '@angular/core';
import { ArrayOrValue, flattenArrayOrValueArray, Maybe } from '@dereekb/util';

/**
 * Merges the input providers into a single array.
 *
 * @param providers
 * @returns
 */
export function mergeStaticProviders(...providers: Maybe<ArrayOrValue<StaticProvider>>[]): StaticProvider[] {
  return flattenArrayOrValueArray<StaticProvider>(providers);
}
