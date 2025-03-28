import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import { FullStorageObject } from '@dereekb/util';
import { SimpleStorageAccessorFactory } from './storage.accessor.simple.factory';
import { DEFAULT_STORAGE_OBJECT_TOKEN, DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN } from './storage.di';
import { FullLocalStorageObject } from './storage.object.localstorage';
import { MemoryStorageObject } from './storage.object.memory';

/**
 * Default storage object factory function that creates a FullLocalStorageObject,
 * falling back to MemoryStorageObject if localStorage is not available.
 */
export function defaultStorageObjectFactory(): FullStorageObject {
  let storageObject: FullStorageObject = new FullLocalStorageObject(localStorage);

  if (!storageObject.isAvailable) {
    storageObject = new MemoryStorageObject();
  }

  return storageObject;
}

/**
 * Creates EnvironmentProviders for providing a default storage object and SimpleStorageAccessorFactory.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxStorage(): EnvironmentProviders {
  const providers: Provider[] = [
    // Storage object
    {
      provide: DEFAULT_STORAGE_OBJECT_TOKEN,
      useFactory: defaultStorageObjectFactory
    },
    // Storage accessor factory
    {
      provide: SimpleStorageAccessorFactory,
      useClass: SimpleStorageAccessorFactory
    },
    {
      provide: DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN,
      useExisting: SimpleStorageAccessorFactory
    }
  ];

  return makeEnvironmentProviders(providers);
}
