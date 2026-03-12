import { type OnDestroy, Component, inject } from '@angular/core';
import { DbxTwoColumnRightComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { loadingStateContext } from '@dereekb/rxjs';
import { OidcEntryDocumentStore } from '@dereekb/dbx-firebase/oidc';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './list.right.component.html',
  imports: [DbxTwoColumnRightComponent, DbxLoadingComponent, DbxContentContainerDirective],
  standalone: true
})
export class DemoAppOAuthClientListPageRightComponent implements OnDestroy {
  readonly oidcEntryStore = inject(OidcEntryDocumentStore);

  readonly context = loadingStateContext({ obs: this.oidcEntryStore.dataLoadingState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
