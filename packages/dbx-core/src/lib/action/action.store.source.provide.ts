import { forwardRef, type Provider, type Type } from '@angular/core';
import { ActionContextStoreSource, DbxActionContextStoreSourceInstance, SecondaryActionContextStoreSource } from './action.store.source';
import { DbxActionContextMachineAsService } from './action.machine';
import { clean } from '../rxjs/clean';

/**
 * Creates Angular DI providers for an {@link ActionContextStoreSource} and its associated {@link DbxActionContextStoreSourceInstance}.
 *
 * When `sourceType` is provided, the existing class is registered as the source. When `null`,
 * a standalone {@link DbxActionContextMachineAsService} is created as the default implementation.
 *
 * @param sourceType - The concrete source class to register, or `null` to use the default machine-based implementation
 * @returns An array of Angular providers
 *
 * @example
 * ```typescript
 * @Directive({
 *   selector: '[myAction]',
 *   providers: provideActionStoreSource(MyActionDirective),
 * })
 * export class MyActionDirective extends ActionContextStoreSource { ... }
 * ```
 */
export function provideActionStoreSource<S extends ActionContextStoreSource>(sourceType: Type<S> | null): Provider[] {
  const storeSourceProvider: Provider =
    sourceType != null
      ? {
          provide: ActionContextStoreSource,
          useExisting: forwardRef(() => sourceType)
        }
      : {
          provide: ActionContextStoreSource,
          useFactory: () => new DbxActionContextMachineAsService()
        };

  return [
    storeSourceProvider,
    {
      provide: DbxActionContextStoreSourceInstance,
      useFactory: (source: ActionContextStoreSource) => clean(new DbxActionContextStoreSourceInstance(source)),
      deps: [ActionContextStoreSource]
    }
  ];
}

/**
 * Creates Angular DI providers for a {@link SecondaryActionContextStoreSource} along with
 * the standard {@link ActionContextStoreSource} and {@link DbxActionContextStoreSourceInstance} providers.
 *
 * @param sourceType - The concrete secondary source class to register
 * @returns An array of Angular providers
 */
export function provideSecondaryActionStoreSource<S extends SecondaryActionContextStoreSource>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: SecondaryActionContextStoreSource,
      useExisting: forwardRef(() => sourceType)
    },
    ...provideActionStoreSource(sourceType)
  ];
}
