import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { type FullStorageObject } from '@dereekb/util';
import { SimpleStorageAccessorFactory } from './storage.accessor.simple.factory';
import { DEFAULT_STORAGE_OBJECT_TOKEN, DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN } from './storage.di';
import { FullLocalStorageObject } from './storage.object.localstorage';
import { MemoryStorageObject } from './storage.object.memory';

/**
 * Creates the default {@link FullStorageObject}, preferring `localStorage` and
 * falling back to an in-memory store if `localStorage` is unavailable.
 *
 * @example
 * ```typescript
 * const storage = defaultStorageObjectFactory();
 * storage.setItem('key', 'value');
 * ```
 */
export function defaultStorageObjectFactory(): FullStorageObject {
  let storageObject: FullStorageObject = new FullLocalStorageObject(localStorage);

  if (!storageObject.isAvailable) {
    storageObject = new MemoryStorageObject();
  }

  return storageObject;
}

/**
 * Registers the default storage object and {@link SimpleStorageAccessorFactory} as environment-level providers.
 *
 * Call in your application config to enable storage-based services throughout the app.
 *
 * @example
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideDbxStorage()],
 * };
 * ```
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
