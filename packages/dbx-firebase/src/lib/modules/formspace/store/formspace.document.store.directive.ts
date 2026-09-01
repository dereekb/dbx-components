import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { type FormSpace, type FormSpaceDocument } from '@dereekb/firebase';
import { FormSpaceDocumentStore } from './formspace.document.store';

/**
 * Directive providing a {@link FormSpaceDocumentStore} for a single FormSpace document.
 */
@Directive({
  selector: '[dbxFirebaseFormSpaceDocument]',
  exportAs: 'dbxFirebaseFormSpaceDocument',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseFormSpaceDocumentStoreDirective, FormSpaceDocumentStore),
  standalone: true
})
export class DbxFirebaseFormSpaceDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<FormSpace, FormSpaceDocument, FormSpaceDocumentStore> {
  constructor() {
    super(inject(FormSpaceDocumentStore));
  }
}
