import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { clientFirebaseFirestoreContextFactory, FirestoreContext } from '@dereekb/firebase';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';
import { Firestore } from '@angular/fire/firestore';
import { ClassLikeType } from '@dereekb/util';
import { SystemStateFirestoreCollections } from '@dereekb/firebase';

export function provideSystemStateFirestoreCollections(appCollection: SystemStateFirestoreCollections): SystemStateFirestoreCollections {
  if (!appCollection.systemStateCollection) {
    throw new Error(`SystemStateFirestoreCollections could not be provided using the app's app collection. Set provideSystemStateFirestoreCollections to false in DbxFirebaseFirestoreCollectionModuleConfig to prevent auto-initialization, or update your aoo's collection class to implement SystemStateFirestoreCollections.`);
  }

  return appCollection;
}

export interface DbxFirebaseFirestoreCollectionModuleConfig<T> {
  appCollectionClass: ClassLikeType<T>;
  collectionFactory: (context: FirestoreContext) => T;
  /**
   * Whether or not to provide the SystemStateFirestoreCollections.
   *
   * True by default.
   */
  provideSystemStateFirestoreCollections?: boolean;
}

/**
 * Used to initialize the FirestoreCollection for a DbxFirebase app.
 */
@NgModule()
export class DbxFirebaseFirestoreCollectionModule {
  static forRoot<T>(config: DbxFirebaseFirestoreCollectionModuleConfig<T>): ModuleWithProviders<DbxFirebaseFirestoreCollectionModule> {
    const providers: Provider[] = [
      {
        provide: DBX_FIRESTORE_CONTEXT_TOKEN,
        useFactory: clientFirebaseFirestoreContextFactory,
        deps: [Firestore]
      },
      {
        provide: config.appCollectionClass,
        useFactory: config.collectionFactory,
        deps: [DBX_FIRESTORE_CONTEXT_TOKEN]
      }
    ];

    if (config.provideSystemStateFirestoreCollections !== false) {
      providers.push({
        /**
         * Provide SystemStateFirestoreCollections via the app collections class and using SystemStateFirestoreCollections.
         */
        provide: SystemStateFirestoreCollections,
        useFactory: provideSystemStateFirestoreCollections,
        deps: [config.appCollectionClass]
      });
    }

    return {
      ngModule: DbxFirebaseFirestoreCollectionModule,
      providers
    };
  }
}
