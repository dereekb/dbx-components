import { type OnDestroy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxTwoColumnRightComponent, DbxLoadingComponent, DbxSectionLayoutModule, DbxContentContainerDirective, DbxMcpConnectButtonComponent, type DbxMcpConnectButtonConfig } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientUpdateComponent, DbxFirebaseOidcEntryClientViewComponent, DbxFirebaseOidcEntryClientTestComponent, OidcEntryDocumentStore } from '@dereekb/dbx-firebase/oidc';
import { type OidcEntryOAuthClientPayloadData, PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD } from '@dereekb/firebase';
import { loadingStateContext } from '@dereekb/rxjs';
import { map } from 'rxjs';

@Component({
  templateUrl: './list.right.component.html',
  imports: [DbxTwoColumnRightComponent, DbxSectionLayoutModule, DbxLoadingComponent, DbxContentContainerDirective, DbxFirebaseOidcEntryClientViewComponent, DbxFirebaseOidcEntryClientUpdateComponent, DbxFirebaseOidcEntryClientTestComponent, DbxMcpConnectButtonComponent]
})
export class DemoAppOidcClientListPageRightComponent implements OnDestroy {
  readonly oidcEntryStore = inject(OidcEntryDocumentStore);

  readonly context = loadingStateContext({ obs: this.oidcEntryStore.dataLoadingState$ });

  readonly clientIdSignal = toSignal(this.oidcEntryStore.data$.pipe(map((data) => (data.payload as OidcEntryOAuthClientPayloadData)?.client_id)));

  // public PKCE clients have no secret; every other client has one, even when this page no longer knows it
  readonly confidentialSignal = toSignal(this.oidcEntryStore.data$.pipe(map((data) => (data.payload as OidcEntryOAuthClientPayloadData)?.token_endpoint_auth_method !== PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD)));

  // the secret is only known right after the client is created or its secret is rotated, so the steps ask for the saved one otherwise
  readonly latestClientSecretSignal = toSignal(this.oidcEntryStore.latestClientSecret$);

  readonly mcpConnectButtonConfigSignal = computed<DbxMcpConnectButtonConfig>(() => {
    const clientId = this.clientIdSignal();

    return {
      buttonStyle: { type: 'stroked' },
      oauthClient: clientId ? { clientId, clientSecret: this.latestClientSecretSignal(), confidential: this.confidentialSignal() } : undefined
    };
  });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
