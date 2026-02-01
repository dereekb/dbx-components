import { inject, DestroyRef, InjectionToken, Provider } from '@angular/core';
import { DbxFirebaseDocumentStoreContextStore } from './store.document.context.store';
import { DbxFirebaseDocumentStore } from './store';

/**
 * Injection token for DbxFirebaseDocumentStoreContextStore.
 */
export const DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN = new InjectionToken<DbxFirebaseDocumentStoreContextStore[]>('DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN');

/**
 * Provides the DbxFirebaseDocumentStoreContextStore.
 */
export function provideDbxFirebaseDocumentStoreContextStore(): Provider[] {
  return [{ provide: DBX_FIREBASE_DOCUMENT_STORE_CONTEXT_STORE_TOKEN, useClass: DbxFirebaseDocumentStoreContextStore, multi: true }];
}

/**
 * Links a DbxFirebaseDocumentStore to parent DbxFirebaseDocumentStoreContextStore instances.
 *
 * This should be called in an injectable context.
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
