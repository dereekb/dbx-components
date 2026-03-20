import { type AnchorForValueFunction, DbxAnchorComponent, DbxButtonComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { type OidcEntry, firestoreModelKey, oidcClientEntriesByOwnerQuery, type DocumentDataWithIdAndKey, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { ChangeDetectionStrategy, Component, inject, viewChild, type OnInit } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DbxFirebaseOidcEntryClientListComponent, OidcEntryCollectionStoreDirective, OidcEntryDocumentStoreDirective } from '@dereekb/dbx-firebase/oidc';
import { DbxFirebaseCollectionListDirective, DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxRouteModelIdDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';
import { profileIdentity } from 'demo-firebase';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, DbxTwoColumnLayoutModule, OidcEntryCollectionStoreDirective, DbxFirebaseOidcEntryClientListComponent, DbxFirebaseCollectionListDirective, DbxListModifierModule, OidcEntryDocumentStoreDirective, DbxRouteModelIdDirective, DbxListItemAnchorModifierDirective, DbxAnchorComponent, DbxButtonComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppOidcClientListPageComponent implements OnInit {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly demoOidcEntryCollectionStoreDirective = viewChild(OidcEntryCollectionStoreDirective);

  readonly oidcClientListRef = this.demoAppRouterService.oidcClientListRef();
  readonly oidcClientCreateRef = this.demoAppRouterService.oidcClientCreateRef();
  readonly makeClientAnchor: AnchorForValueFunction<DocumentDataWithIdAndKey<OidcEntry>> = (doc) => this.demoAppRouterService.oidcClientRef(doc.id);

  readonly clientConstraintsSignal = toSignal(
    this.dbxFirebaseAuthService.currentAuthUser$.pipe(
      map((user) => {
        let constraints: FirestoreQueryConstraint[] = [];

        if (user?.uid) {
          const ownershipKey = firestoreModelKey(profileIdentity, user.uid);
          constraints = oidcClientEntriesByOwnerQuery(ownershipKey);
        }

        return constraints;
      })
    )
  );

  ngOnInit(): void {
    const x = this.demoOidcEntryCollectionStoreDirective();

    x?.setMaxPages(5);
    x?.setItemsPerPage(10);
  }
}
