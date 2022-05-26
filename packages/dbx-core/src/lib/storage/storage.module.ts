import { ModuleWithProviders, NgModule } from '@angular/core';
import { FullStorageObject } from '@dereekb/util';
import { SimpleStorageAccessorFactory } from './storage.accessor.simple.factory';
import { DEFAULT_STORAGE_OBJECT_TOKEN, DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN } from './storage.di';
import { FullLocalStorageObject } from './storage.object.localstorage';
import { MemoryStorageObject } from './storage.object.memory';

export function defaultStorageObjectFactory(): FullStorageObject {
  let storageObject: FullStorageObject = new FullLocalStorageObject(localStorage);

  if (!storageObject.isAvailable) {
    storageObject = new MemoryStorageObject();
  }

  return storageObject;
}

@NgModule()
export class DbxStorageModule {
  static forRoot(): ModuleWithProviders<DbxStorageModule> {
    return {
      ngModule: DbxStorageModule,
      providers: [
        {
          provide: DEFAULT_STORAGE_OBJECT_TOKEN,
          useFactory: defaultStorageObjectFactory
        },
        {
          provide: DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN,
          useClass: SimpleStorageAccessorFactory
        },
        {
          provide: SimpleStorageAccessorFactory,
          useExisting: DEFAULT_STORAGE_ACCESSOR_FACTORY_TOKEN
        }
      ]
    };
  }
}
