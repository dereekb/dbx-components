import { ChangeDetectionStrategy, Component, inject, type OnInit, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DbxFirebaseAuthService, DbxFirebaseCollectionChangeDirective, DbxFirebaseCollectionListDirective } from '@dereekb/dbx-firebase';
import { type FirestoreQueryConstraint, oidcGrantEntriesByUidQuery } from '@dereekb/firebase';
import { OidcEntryCollectionStoreDirective } from '../store/oidcentry.collection.store.directive';
import { DbxFirebaseOidcEntryGrantListComponent } from '../component/oidcentry.grant.list.component';

/**
 * Drop-in container for the "apps with access to my account" management UI.
 *
 * Wires a {@link OidcEntryCollectionStoreDirective} to query Grant entries
 * for the signed-in user, then renders {@link DbxFirebaseOidcEntryGrantListComponent}
 * with inline Revoke buttons. No inputs — the container resolves the current
 * user via {@link DbxFirebaseAuthService}.
 */
@Component({
  selector: 'dbx-firebase-oidc-grant-list-container',
  template: `
    <div dbxOidcEntryCollection dbxFirebaseCollectionChange="auto" [constraints]="grantConstraintsSignal()">
      <dbx-firebase-oidc-grant-list dbxFirebaseCollectionList></dbx-firebase-oidc-grant-list>
    </div>
  `,
  standalone: true,
  imports: [OidcEntryCollectionStoreDirective, DbxFirebaseCollectionListDirective, DbxFirebaseCollectionChangeDirective, DbxFirebaseOidcEntryGrantListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryGrantListContainerComponent implements OnInit {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly oidcEntryCollectionStoreDirective = viewChild(OidcEntryCollectionStoreDirective);

  readonly grantConstraintsSignal = toSignal<FirestoreQueryConstraint[]>(this.dbxFirebaseAuthService.currentAuthUser$.pipe(map((user) => (user?.uid ? oidcGrantEntriesByUidQuery(user.uid) : []))));

  ngOnInit(): void {
    const directive = this.oidcEntryCollectionStoreDirective();
    directive?.setMaxPages(5);
    directive?.setItemsPerPage(20);
  }
}
