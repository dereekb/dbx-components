import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxContentPitDirective, DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxButtonComponent, DbxActionConfirmDirective, type DbxActionConfirmConfig } from '@dereekb/dbx-web';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { OidcEntryDocumentStore } from '../store/oidcentry.document.store';
import { PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD, type OidcEntryOAuthClientPayloadData } from '@dereekb/firebase';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type WorkUsingContext } from '@dereekb/rxjs';

/**
 * Displays the OIDC client ID and (when available) the one-time client secret.
 *
 * The client secret is only shown immediately after creation or after rotating.
 * When no secret is available, a "Rotate Secret" button is shown.
 *
 * Public PKCE clients (`token_endpoint_auth_method === 'none'`) have no secret: the secret
 * block, the one-time "copy it now" messaging, and the rotate button are all hidden in favor
 * of a note explaining the client authenticates with PKCE alone.
 */
@Component({
  selector: 'dbx-firebase-oidc-entry-client-view',
  template: `
    <dbx-content-pit>
      <dbx-detail-block class="dbx-pb4" icon="key" header="Client ID">
        <dbx-click-to-copy-text [copyText]="clientIdSignal()">{{ clientIdSignal() }}</dbx-click-to-copy-text>
      </dbx-detail-block>
      @if (isPublicClientSignal()) {
        <dbx-detail-block icon="lock_open" header="Client Secret">
          <div class="dbx-hint">This is a public client (PKCE) with no client secret. It authenticates the authorization code flow using PKCE alone.</div>
        </dbx-detail-block>
      } @else {
        <dbx-detail-block icon="lock" header="Client Secret">
          @if (latestClientSecretSignal()) {
            <dbx-click-to-copy-text class="dbx-block dbx-pb2" [copyText]="latestClientSecretSignal()">{{ latestClientSecretSignal() }}</dbx-click-to-copy-text>
            <dbx-click-to-copy-text [copyText]="latestClientSecretSignal()" [showIcon]="false"><div class="dbx-hint dbx-u">This secret is only shown once. Copy it now.</div></dbx-click-to-copy-text>
          } @else {
            <div>
              <div class="dbx-hint dbx-pb3">The client secret was shown once when created. You can invalidate the old one and get a new one.</div>
              <dbx-button dbxAction [dbxActionHandler]="handleRotateClientSecret" [dbxActionConfirm]="rotateSecretConfirmConfig" dbxActionButton text="Rotate Secret" icon="refresh" color="warn" [raised]="true"></dbx-button>
            </div>
          }
        </dbx-detail-block>
      }
    </dbx-content-pit>
  `,
  standalone: true,
  imports: [CommonModule, DbxContentPitDirective, DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxButtonComponent, DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionConfirmDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryClientViewComponent {
  readonly oidcEntryDocumentStore = inject(OidcEntryDocumentStore);

  readonly clientIdSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => (data.payload as OidcEntryOAuthClientPayloadData)?.client_id)));
  readonly tokenEndpointAuthMethodSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => (data.payload as OidcEntryOAuthClientPayloadData)?.token_endpoint_auth_method)));
  readonly isPublicClientSignal = computed(() => this.tokenEndpointAuthMethodSignal() === PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD);
  readonly latestClientSecretSignal = toSignal(this.oidcEntryDocumentStore.latestClientSecret$);

  readonly rotateSecretConfirmConfig: DbxActionConfirmConfig = {
    title: 'Rotate Client Secret',
    prompt: 'This will invalidate the current client secret. Any applications using it will stop working. Are you sure?',
    confirmText: 'Rotate Secret'
  };

  readonly handleRotateClientSecret: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.oidcEntryDocumentStore.rotateClientSecret({}));
  };
}
