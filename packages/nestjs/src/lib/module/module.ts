import { mergeArrays, type ArrayOrValue, asArray } from '@dereekb/util';
import { type ModuleMetadata, type Provider, type InjectionToken } from '@nestjs/common';

export type AdditionalModuleMetadata = Partial<ModuleMetadata>;

/**
 * Merges two module metadata entries together.
 *
 * @param base
 * @param additional
 * @returns
 */
export function mergeModuleMetadata(base: ModuleMetadata, additional: AdditionalModuleMetadata = {}): ModuleMetadata {
  return {
    controllers: mergeArrays([base.controllers, additional.controllers]),
    imports: mergeArrays([base.imports, additional.imports]),
    exports: mergeArrays([base.exports, additional.exports]),
    providers: mergeArrays([base.providers, additional.providers])
  };
}

export function injectionTokensFromProviders(providers: ArrayOrValue<Provider<unknown>>): InjectionToken[] {
  return asArray(providers).map((x) => {
    return typeof x === 'object' ? x.provide : x;
  });
}
