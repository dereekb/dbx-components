import { ChangeDetectionStrategy, Component, inject, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, combineLatest } from 'rxjs';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxFormSourceDirective, DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { type OidcEntryOAuthClientPayloadData } from '@dereekb/firebase';
import { OidcEntryDocumentStore } from '../store/oidcentry.document.store';
import { DbxFirebaseOidcEntryClientTestFormComponent, type DbxFirebaseOidcModelClientTestFormValue } from '../component/oidcentry.client.test.form.component';
import { type OidcEntryClientTestFormFieldsConfig } from '../component/oidcentry.form';
import { generatePkceCodeVerifier, generatePkceCodeChallenge } from '../util/pkce';
import { DbxFirebaseOidcConfigService } from '../../../service/oidc.configuration.service';

/**
 * Container component for testing an OAuth authorization flow against a registered client.
 *
 * Displays a form with the client's ID, secret, redirect URIs, and scopes,
 * then builds an authorization URL with PKCE parameters that can be opened in a new tab.
 */
@Component({
  selector: 'dbx-firebase-oidc-entry-client-test',
  template: `
    @if (formConfig()) {
      <dbx-firebase-oidc-client-test-form [dbxFormSource]="formTemplate$" dbxFormSourceMode="always" [config]="formConfig()" (dbxFormValueChange)="onFormValueChange($event)"></dbx-firebase-oidc-client-test-form>
      <dbx-content-pit class="dbx-block dbx-mb3" [rounded]="true">
        <dbx-detail-block class="dbx-pb4" icon="link" header="Authorization URL">
          @if (authorizationUrlSignal()) {
            <dbx-click-to-copy-text [copyText]="authorizationUrlSignal()">
              <div class="dbx-small-text" style="word-break: break-all;">{{ authorizationUrlSignal() }}</div>
            </dbx-click-to-copy-text>
          } @else {
            <div class="dbx-hint">Fill in the form above to generate the URL.</div>
          }
        </dbx-detail-block>
        <dbx-detail-block icon="vpn_key" header="Code Verifier (for token exchange)">
          <dbx-click-to-copy-text [copyText]="codeVerifier()">{{ codeVerifier() }}</dbx-click-to-copy-text>
        </dbx-detail-block>
      </dbx-content-pit>
      <div class="dbx-mb3">
        <dbx-button class="dbx-button-spacer" [raised]="true" color="primary" text="Start Authorization Flow" icon="open_in_new" [disabled]="!authorizationUrlSignal()" (buttonClick)="openAuthorizationUrl()"></dbx-button>
        <dbx-button class="dbx-ml2" text="Regenerate PKCE" icon="refresh" (buttonClick)="regeneratePkce()"></dbx-button>
      </div>
    }
  `,
  standalone: true,
  imports: [CommonModule, DbxFirebaseOidcEntryClientTestFormComponent, DbxFormSourceDirective, DbxFormValueChangeDirective, DbxContentPitDirective, DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryClientTestComponent {
  private readonly oidcEntryDocumentStore = inject(OidcEntryDocumentStore);
  private readonly oidcConfigService = inject(DbxFirebaseOidcConfigService);

  /** Scopes the user can pick from. Overrides the service default when provided. */
  readonly availableScopes = input<Maybe<LabeledValue<string>[]>>(undefined);

  /** Path to the authorization endpoint. Overrides the service default when provided. */
  readonly oidcAuthorizationEndpointApiPath = input<Maybe<string>>(undefined);

  readonly resolvedAvailableScopes = computed<LabeledValue<string>[]>(() => this.availableScopes() ?? this.oidcConfigService.availableScopes);
  readonly resolvedAuthorizationEndpointPath = computed<string>(() => this.oidcAuthorizationEndpointApiPath() ?? this.oidcConfigService.oidcAuthorizationEndpointApiPath);

  // MARK: Derived Store Data
  readonly redirectUrisSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => (data.payload as OidcEntryOAuthClientPayloadData)?.redirect_uris ?? [])));

  readonly clientIdSignal = toSignal(this.oidcEntryDocumentStore.data$.pipe(map((data) => (data.payload as OidcEntryOAuthClientPayloadData)?.client_id)));

  // MARK: Form Config
  readonly formConfig = computed<OidcEntryClientTestFormFieldsConfig | undefined>(() => {
    const redirectUris = this.redirectUrisSignal();
    const availableScopes = this.resolvedAvailableScopes();

    if (redirectUris) {
      return { redirectUris, availableScopes };
    }

    return undefined;
  });

  readonly formTemplate$ = combineLatest([this.oidcEntryDocumentStore.data$, this.oidcEntryDocumentStore.latestClientSecret$]).pipe(
    map(([data, latestClientSecret]) => {
      const payload = data.payload as OidcEntryOAuthClientPayloadData;
      const formValue: DbxFirebaseOidcModelClientTestFormValue = {
        client_id: payload?.client_id ?? '',
        client_secret: latestClientSecret ?? '',
        redirect_uri: payload?.redirect_uris?.[0] ?? '',
        scopes: ['openid']
      };
      return formValue;
    })
  );

  // MARK: PKCE
  readonly codeVerifier = signal<string>(generatePkceCodeVerifier());
  readonly codeChallenge = signal<string>('');
  readonly state = signal<string>(generateRandomString());
  readonly nonce = signal<string>(generateRandomString());

  /** The current form value, updated by the form via dbxFormValueChange. */
  readonly formValue = signal<Maybe<DbxFirebaseOidcModelClientTestFormValue>>(undefined);

  readonly authorizationUrlSignal = computed(() => {
    const clientId = this.clientIdSignal();
    const codeChallenge = this.codeChallenge();
    const state = this.state();
    const nonce = this.nonce();
    const formValue = this.formValue();

    if (!clientId || !codeChallenge || !formValue?.redirect_uri) {
      return undefined;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: formValue.redirect_uri,
      scope: (formValue.scopes ?? ['openid']).join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${this.resolvedAuthorizationEndpointPath()}?${params.toString()}`;
  });

  constructor() {
    this._updateCodeChallenge();
  }

  onFormValueChange(value: Maybe<DbxFirebaseOidcModelClientTestFormValue>): void {
    this.formValue.set(value);
  }

  openAuthorizationUrl(): void {
    const url = this.authorizationUrlSignal();

    if (url) {
      window.open(url, '_blank');
    }
  }

  regeneratePkce(): void {
    this.codeVerifier.set(generatePkceCodeVerifier());
    this.state.set(generateRandomString());
    this.nonce.set(generateRandomString());
    this._updateCodeChallenge();
  }

  private _updateCodeChallenge(): void {
    generatePkceCodeChallenge(this.codeVerifier()).then((challenge) => {
      this.codeChallenge.set(challenge);
    });
  }
}

function generateRandomString(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
