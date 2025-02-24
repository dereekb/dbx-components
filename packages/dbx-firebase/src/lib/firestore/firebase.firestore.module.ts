import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { clientFirebaseFirestoreContextFactory, FirestoreContext, NotificationFirestoreCollections, SystemStateFirestoreCollections } from '@dereekb/firebase';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';
import { Firestore } from '@angular/fire/firestore';
import { ClassLikeType } from '@dereekb/util';

export function provideSystemStateFirestoreCollections(appCollection: SystemStateFirestoreCollections): SystemStateFirestoreCollections {
  if (!appCollection.systemStateCollection) {
    throw new Error(`SystemStateFirestoreCollections could not be provided using the app's app collection. Set provideSystemStateFirestoreCollections to false in DbxFirebaseFirestoreCollectionModuleConfig to prevent auto-initialization, or update your app's collection class to implement SystemStateFirestoreCollections.`);
  }

  return appCollection;
}

export function provideNotificationFirestoreCollections(appCollection: NotificationFirestoreCollections): NotificationFirestoreCollections {
  if (!appCollection.notificationSummaryCollection) {
    throw new Error(`NotificationFirestoreCollections could not be provided using the app's app collection. Set provideNotificationFirestoreCollections to false in DbxFirebaseFirestoreCollectionModuleConfig to prevent auto-initialization, or update your app's collection class to implement NotificationFirestoreCollections.`);
  }

  return appCollection;
}

export interface DbxFirebaseFirestoreCollectionModuleConfig<T> {
  readonly appCollectionClass: ClassLikeType<T>;
  readonly collectionFactory: (context: FirestoreContext) => T;
  /**
   * Whether or not to provide the SystemStateFirestoreCollections.
   *
   * True by default.
   */
  readonly provideSystemStateFirestoreCollections?: boolean;
  /**
   * Whether or not to provide the NotificationFirestoreCollections.
   *
   * False by default.
   */
  readonly provideNotificationFirestoreCollections?: boolean;
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

    if (config.provideNotificationFirestoreCollections) {
      providers.push({
        provide: NotificationFirestoreCollections,
        useFactory: provideNotificationFirestoreCollections,
        deps: [config.appCollectionClass]
      });
    }

    return {
      ngModule: DbxFirebaseFirestoreCollectionModule,
      providers
    };
  }
}
