import { inject, DestroyRef, InjectionToken, type Provider } from '@angular/core';
import { DbxFirebaseDocumentStoreContextStore } from './store.document.context.store';
import { type DbxFirebaseDocumentStore } from './store';

/**
 * Injection token for DbxFirebaseDocumentStoreContextStore.
 */
export const DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN = new InjectionToken<DbxFirebaseDocumentStoreContextStore[]>('DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN');

/**
 * Provides the DbxFirebaseDocumentStoreContextStore.
 */
export function provideDbxFirebaseDocumentStoreContextStore(): Provider[] {
  return [
    {
      // Create/Provide a "nearest" DbxFirebaseDocumentStoreContextStore.
      provide: DbxFirebaseDocumentStoreContextStore
    },
    {
      // Also make that context store available to the DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN.
      provide: DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN,
      useExisting: DbxFirebaseDocumentStoreContextStore,
      multi: true
    }
  ];
}

/**
 * Links a DbxFirebaseDocumentStore to parent DbxFirebaseDocumentStoreContextStore instances.
 *
 * This should be called in an Angular injection context.
 */
export function linkDocumentStoreToParentContextStores(store: DbxFirebaseDocumentStore<any, any>) {
  const contextStores = inject(DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN, { optional: true });
  const destroyRef = inject(DestroyRef);

  if (contextStores) {
    // add the store to each available context store
    contextStores.forEach((contextStore) => {
      contextStore.addStore(store);
    });

    // remove the store from each available context store when the context is destroyed
    destroyRef.onDestroy(() => {
      contextStores.forEach((contextStore) => {
        contextStore.removeStore(store);
      });
    });
  }
}
