import { forwardRef, type Provider, type Type } from '@angular/core';
import { ActionContextStoreSource, DbxActionContextStoreSourceInstance, SecondaryActionContextStoreSource } from './action.store.source';
import { DbxActionContextMachineAsService } from './action.machine';

export const actionContextStoreSourceInstanceFactory = (source: ActionContextStoreSource) => {
  return new DbxActionContextStoreSourceInstance(source);
};

export const actionContextStoreSourceMachineFactory = () => {
  return new DbxActionContextMachineAsService();
};

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
          useFactory: actionContextStoreSourceMachineFactory
        };

  return [
    storeSourceProvider,
    {
      provide: DbxActionContextStoreSourceInstance,
      useFactory: actionContextStoreSourceInstanceFactory,
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
