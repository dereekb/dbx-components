import { Injectable, inject } from '@angular/core';
import { type StorageAccessor } from './storage.accessor';
import { type SimpleStorageAccessorConfig, SimpleStorageAccessor, type SimpleStorageAccessorConverter, StringifySimpleStorageAccessorConverter, WrapperSimpleStorageAccessorDelegate } from './storage.accessor.simple';
import { StringStorageAccessor } from './storage.accessor.string';
import { DEFAULT_STORAGE_OBJECT_TOKEN } from './storage.di';
import { type FullStorageObject, type StoredDataString } from '@dereekb/util';

/**
 * Configuration for creating a {@link SimpleStorageAccessor} via the factory,
 * with optional overrides for the storage backend and value converter.
 *
 * @typeParam T - The type of values the created accessor will store.
 */
export interface StorageAccessorFactoryConfig<T> extends SimpleStorageAccessorConfig {
  storage?: StorageAccessor<StoredDataString>;
  converter?: SimpleStorageAccessorConverter<T>;
}

/**
 * Injectable factory for creating namespaced {@link SimpleStorageAccessor} instances
 * backed by the application's default storage object.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserPrefsService {
 *   private readonly storage = inject(SimpleStorageAccessorFactory)
 *     .createStorageAccessor<UserPrefs>({ prefix: 'user_prefs' });
 *
 *   save(prefs: UserPrefs) { return this.storage.set('current', prefs); }
 *   load() { return this.storage.get('current'); }
 * }
 * ```
 */
@Injectable()
export class SimpleStorageAccessorFactory {
  readonly storageObject = inject<FullStorageObject>(DEFAULT_STORAGE_OBJECT_TOKEN);

  createStorageAccessor<T>(config: StorageAccessorFactoryConfig<T>): SimpleStorageAccessor<T> {
    const storage = config.storage ?? new StringStorageAccessor(this.storageObject);
    const converter = config.converter ?? new StringifySimpleStorageAccessorConverter<T>();
    const delegate = new WrapperSimpleStorageAccessorDelegate<T>(storage, converter);

    const accessorConfig = {
      prefix: config.prefix
    };

    return new SimpleStorageAccessor<T>(delegate, accessorConfig);
  }
}
