import { type OnDestroy, Component, inject } from '@angular/core';
import { DbxTwoColumnRightComponent, DbxLoadingComponent, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientUpdateComponent, DbxFirebaseOidcEntryClientViewComponent, DbxFirebaseOidcEntryClientTestComponent } from '@dereekb/dbx-firebase/oidc';
import { loadingStateContext } from '@dereekb/rxjs';
import { OidcEntryDocumentStore } from '@dereekb/dbx-firebase/oidc';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './list.right.component.html',
  imports: [DbxTwoColumnRightComponent, DbxSectionLayoutModule, DbxLoadingComponent, DbxContentContainerDirective, DbxFirebaseOidcEntryClientViewComponent, DbxFirebaseOidcEntryClientUpdateComponent, DbxFirebaseOidcEntryClientTestComponent],
  standalone: true
})
export class DemoAppOidcClientListPageRightComponent implements OnDestroy {
  readonly oidcEntryStore = inject(OidcEntryDocumentStore);

  readonly context = loadingStateContext({ obs: this.oidcEntryStore.dataLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
