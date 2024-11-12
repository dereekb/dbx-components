import { Directive, OnInit, inject } from '@angular/core';
import { FirestoreDocument } from '@dereekb/firebase';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';

/**
 * Utility directive for a host DbxFirebaseDocumentStoreDirective that sets the document's ID to match the ID of the current user.
 *
 * This is useful for cases where each document is keyed by the user (I.E. implements UserRelatedById).
 */
@Directive({
  selector: '[dbxFirebaseDocumentAuthId]'
})
export class DbxFirebaseDocumentAuthIdDirective<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends AbstractSubscriptionDirective implements OnInit {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective<T, D>, { host: true });

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setId(this.dbxFirebaseAuthService.userIdentifier$);
  }
}
