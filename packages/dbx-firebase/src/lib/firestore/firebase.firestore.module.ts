import { ModuleWithProviders, NgModule } from '@angular/core';
import { clientFirebaseFirestoreContextFactory, FirestoreContext } from '@dereekb/firebase';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';
import { Firestore } from '@angular/fire/firestore';
import { ClassLikeType } from '@dereekb/util';

export interface DbxFirebaseFirestoreCollectionModuleConfig<T> {
  appCollectionClass: ClassLikeType<T>;
  collectionFactory: (context: FirestoreContext) => T;
}

/**
 * Used to initialize the FirestoreCollection for a DbxFirebase app.
 */
@NgModule()
export class DbxFirebaseFirestoreCollectionModule {
  static forRoot<T>(config: DbxFirebaseFirestoreCollectionModuleConfig<T>): ModuleWithProviders<DbxFirebaseFirestoreCollectionModule> {
    return {
      ngModule: DbxFirebaseFirestoreCollectionModule,
      providers: [
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
      ]
    };
  }
}
