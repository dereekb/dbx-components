import { type AnchorForValueFunction, DbxAnchorComponent, DbxButtonComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { type OidcEntry, oidcClientEntriesByOwnerQuery } from '@dereekb/firebase';
import { Component, inject, viewChild, type OnInit } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DbxOidcEntryClientListComponent, DbxOidcEntryCollectionStoreDirective, DbxOidcEntryDocumentStoreDirective } from '@dereekb/dbx-firebase/oidc';
import { DbxFirebaseCollectionListDirective } from '@dereekb/dbx-firebase';
import { DbxRouteModelIdDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';
import { type DocumentDataWithIdAndKey, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, DbxTwoColumnLayoutModule, DbxOidcEntryCollectionStoreDirective, DbxOidcEntryClientListComponent, DbxFirebaseCollectionListDirective, DbxListModifierModule, DbxOidcEntryDocumentStoreDirective, DbxRouteModelIdDirective, DbxListItemAnchorModifierDirective, DbxAnchorComponent, DbxButtonComponent],
  standalone: true
})
export class DemoAppOAuthClientListPageComponent implements OnInit {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly demoOidcEntryCollectionStoreDirective = viewChild(DbxOidcEntryCollectionStoreDirective);

  clientConstraints: FirestoreQueryConstraint[] = [];

  readonly oauthClientListRef = this.demoAppRouterService.oauthClientListRef();
  readonly oauthClientCreateRef = this.demoAppRouterService.oauthClientCreateRef();
  readonly makeClientAnchor: AnchorForValueFunction<DocumentDataWithIdAndKey<OidcEntry>> = (doc) => this.demoAppRouterService.oauthClientRef(doc.id);

  ngOnInit(): void {
    const x = this.demoOidcEntryCollectionStoreDirective();

    x?.setMaxPages(5);
    x?.setItemsPerPage(10);

    this.dbxFirebaseAuthService.currentAuthUser$.subscribe((user) => {
      if (user?.uid) {
        this.clientConstraints = oidcClientEntriesByOwnerQuery(user.uid);
      }
    });
  }
}
