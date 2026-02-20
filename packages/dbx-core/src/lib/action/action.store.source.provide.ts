import { forwardRef, type Provider, type Type } from '@angular/core';
import { ActionContextStoreSource, DbxActionContextStoreSourceInstance, SecondaryActionContextStoreSource } from './action.store.source';
import { DbxActionContextMachineAsService } from './action.machine';
import { clean } from '../rxjs/clean';

/**
 * Provides an ActionContextStoreSource, as well as an DbxActionContextStoreSourceInstance.
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

export function provideSecondaryActionStoreSource<S extends SecondaryActionContextStoreSource>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: SecondaryActionContextStoreSource,
      useExisting: forwardRef(() => sourceType)
    },
    ...provideActionStoreSource(sourceType)
  ];
}
