import { mergeArrays, type ArrayOrValue, asArray } from '@dereekb/util';
import { type ModuleMetadata, type Provider, type InjectionToken } from '@nestjs/common';

export type AdditionalModuleMetadata = Partial<ModuleMetadata>;

/**
 * Merges two module metadata entries together.
 *
 * @param base - the base module metadata
 * @param additional - additional metadata to merge in
 * @returns the merged module metadata
 */
export function mergeModuleMetadata(base: ModuleMetadata, additional: AdditionalModuleMetadata = {}): ModuleMetadata {
  return {
    controllers: mergeArrays([base.controllers, additional.controllers]),
    imports: mergeArrays([base.imports, additional.imports]),
    exports: mergeArrays([base.exports, additional.exports]),
    providers: mergeArrays([base.providers, additional.providers])
  };
}

/**
 * Extracts the injection tokens from an array (or single value) of NestJS Providers.
 *
 * For class providers, returns the class itself; for object providers, returns the provide token.
 *
 * @param providers - the providers to extract tokens from
 * @returns an array of injection tokens
 */
export function injectionTokensFromProviders(providers: ArrayOrValue<Provider<unknown>>): InjectionToken[] {
  return asArray(providers).map((x) => {
    return typeof x === 'object' ? x.provide : x;
  });
}
