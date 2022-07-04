import { Injector, ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { Storage } from '@angular/fire/storage';
import { clientFirebaseStorageContextFactory, firebaseStorageContextFactory, FirebaseStorageContextFactoryConfig } from '@dereekb/firebase';
import { DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN, DBX_FIREBASE_STORAGE_CONTEXT_TOKEN } from './firebase.storage';
import { DbxFirebaseStorageService } from './firebase.storage.service';

export function dbxFirebaseStorageModuleContextConfigFactory(base?: FirebaseStorageContextFactoryConfig): DbxFirebaseStorageModuleContextConfigFactory {
  return (app: FirebaseApp, injector: Injector) => {
    return {
      defaultBucketId: base?.defaultBucketId || app.options.storageBucket,
      forceBucket: base?.forceBucket ?? false
    };
  };
}

export type DbxFirebaseStorageModuleContextConfigFactory = (app: FirebaseApp, injector: Injector) => FirebaseStorageContextFactoryConfig;

export interface DbxFirebaseStorageModuleConfig {
  contextConfig?: FirebaseStorageContextFactoryConfig;
  contextConfigFactory?: DbxFirebaseStorageModuleContextConfigFactory;
}

@NgModule({})
export class DbxFirebaseStorageModule {
  static forRoot(config?: DbxFirebaseStorageModuleConfig): ModuleWithProviders<DbxFirebaseStorageModule> {
    const configFactory = config?.contextConfigFactory ?? dbxFirebaseStorageModuleContextConfigFactory(config?.contextConfig);

    const providers: Provider[] = [
      {
        provide: DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN,
        useFactory: configFactory,
        deps: [FirebaseApp, Injector]
      },
      {
        provide: DBX_FIREBASE_STORAGE_CONTEXT_TOKEN,
        useFactory: clientFirebaseStorageContextFactory,
        deps: [Storage, DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN]
      },
      DbxFirebaseStorageService
    ];

    return {
      ngModule: DbxFirebaseStorageModule,
      providers
    };
  }
}
