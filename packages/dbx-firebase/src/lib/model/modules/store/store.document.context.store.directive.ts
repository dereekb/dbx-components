import { Directive } from '@angular/core';
import { provideDbxFirebaseDocumentStoreContextStore } from './store.document.context.store.link';

/**
 * Directive that provides a DbxFirebaseDocumentStoreContextStore.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreContextStore]',
  providers: provideDbxFirebaseDocumentStoreContextStore()
})
export class DbxFirebaseDocumentStoreContextStoreDirective {}
