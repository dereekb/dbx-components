import { type StaticProvider } from '@angular/core';
import { type ArrayOrValue, flattenArrayOrValueArray, type Maybe } from '@dereekb/util';

/**
 * Flattens and merges multiple provider sources into a single `StaticProvider[]` array.
 *
 * Each argument can be a single `StaticProvider`, an array of providers, or `undefined`/`null`.
 * All values are flattened into a single array with nullish entries removed.
 *
 * @param providers - Any number of provider values or arrays to merge.
 * @returns A flat array of all non-nullish static providers.
 *
 * @example
 * ```typescript
 * const providers = mergeStaticProviders(
 *   { provide: TOKEN_A, useValue: 'a' },
 *   undefined,
 *   [{ provide: TOKEN_B, useValue: 'b' }]
 * );
 * // Result: [{ provide: TOKEN_A, useValue: 'a' }, { provide: TOKEN_B, useValue: 'b' }]
 * ```
 */
export function mergeStaticProviders(...providers: Maybe<ArrayOrValue<StaticProvider>>[]): StaticProvider[] {
  return flattenArrayOrValueArray<StaticProvider>(providers);
}
