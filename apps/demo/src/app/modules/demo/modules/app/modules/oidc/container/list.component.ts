import { type AnchorForValueFunction, DbxAnchorComponent, DbxButtonComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { type OidcEntry, firestoreModelKey, oidcClientEntriesByOwnerQuery } from '@dereekb/firebase';
import { Component, inject, viewChild, type OnInit } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DbxFirebaseOidcEntryClientListComponent, OidcEntryCollectionStoreDirective, OidcEntryDocumentStoreDirective } from '@dereekb/dbx-firebase/oidc';
import { DbxFirebaseCollectionListDirective } from '@dereekb/dbx-firebase';
import { cleanSubscription, DbxRouteModelIdDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';
import { type DocumentDataWithIdAndKey, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { profileIdentity } from 'demo-firebase';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, DbxTwoColumnLayoutModule, OidcEntryCollectionStoreDirective, DbxFirebaseOidcEntryClientListComponent, DbxFirebaseCollectionListDirective, DbxListModifierModule, OidcEntryDocumentStoreDirective, DbxRouteModelIdDirective, DbxListItemAnchorModifierDirective, DbxAnchorComponent, DbxButtonComponent],
  standalone: true
})
export class DemoAppOidcClientListPageComponent implements OnInit {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly demoOidcEntryCollectionStoreDirective = viewChild(OidcEntryCollectionStoreDirective);

  clientConstraints: FirestoreQueryConstraint[] = [];

  readonly oidcClientListRef = this.demoAppRouterService.oidcClientListRef();
  readonly oidcClientCreateRef = this.demoAppRouterService.oidcClientCreateRef();
  readonly makeClientAnchor: AnchorForValueFunction<DocumentDataWithIdAndKey<OidcEntry>> = (doc) => this.demoAppRouterService.oidcClientRef(doc.id);

  constructor() {
    cleanSubscription(
      this.dbxFirebaseAuthService.currentAuthUser$.subscribe((user) => {
        if (user?.uid) {
          const ownershipKey = firestoreModelKey(profileIdentity, user.uid);
          this.clientConstraints = oidcClientEntriesByOwnerQuery(ownershipKey);
        }
      })
    );
  }

  ngOnInit(): void {
    const x = this.demoOidcEntryCollectionStoreDirective();

    x?.setMaxPages(5);
    x?.setItemsPerPage(10);
  }
}
