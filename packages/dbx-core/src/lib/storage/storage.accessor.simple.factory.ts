import { Injectable, inject } from '@angular/core';
import { StorageAccessor } from './storage.accessor';
import { SimpleStorageAccessorConfig, SimpleStorageAccessor, SimpleStorageAccessorConverter, StringifySimpleStorageAccessorConverter, WrapperSimpleStorageAccessorDelegate } from './storage.accessor.simple';
import { StringStorageAccessor } from './storage.accessor.string';
import { DEFAULT_STORAGE_OBJECT_TOKEN } from './storage.di';
import { FullStorageObject, StoredDataString } from '@dereekb/util';

export interface StorageAccessorFactoryConfig<T> extends SimpleStorageAccessorConfig {
  storage?: StorageAccessor<StoredDataString>;
  converter?: SimpleStorageAccessorConverter<T>;
}

/**
 * Used for building SimpleStorageAccessor instances from SimpleStorageAccessorConfig.
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
