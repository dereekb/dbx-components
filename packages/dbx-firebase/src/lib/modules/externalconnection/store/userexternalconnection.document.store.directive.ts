import { Directive, inject } from '@angular/core';
import { type UserExternalConnection, type UserExternalConnectionDocument } from '@dereekb/firebase';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { UserExternalConnectionDocumentStore } from './userexternalconnection.document.store';

/**
 * Directive providing a {@link UserExternalConnectionDocumentStore} for a single user's connection document.
 */
@Directive({
  selector: '[dbxFirebaseUserExternalConnectionDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseUserExternalConnectionDocumentStoreDirective, UserExternalConnectionDocumentStore)
})
export class DbxFirebaseUserExternalConnectionDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<UserExternalConnection, UserExternalConnectionDocument, UserExternalConnectionDocumentStore> {
  constructor() {
    super(inject(UserExternalConnectionDocumentStore));
  }
}
