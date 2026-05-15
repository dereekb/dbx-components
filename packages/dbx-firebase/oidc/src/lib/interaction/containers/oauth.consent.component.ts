import { ChangeDetectionStrategy, Component, computed, inject, input, type OnDestroy, type Signal, type Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { dbxRouteParamReaderInstance, DbxRouterService, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { tap } from 'rxjs';
import { DbxFirebaseOidcInteractionService } from '../../service/oidc.interaction.service';
import { DbxFirebaseOidcConfigService, DEFAULT_OIDC_CLIENT_ID_PARAM_KEY, DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY, DEFAULT_OIDC_CLIENT_URI_PARAM_KEY, DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY, DEFAULT_OIDC_LOGO_URI_PARAM_KEY, DEFAULT_OIDC_SCOPES_PARAM_KEY } from '../../service/oidc.configuration.service';
import { type OAuthInteractionConsentResponse, type OAuthInteractionLoginDetails, type OidcScope } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseOAuthConsentViewComponent, type OidcConsentStateCase } from '../components/oauth.consent.view.component';
import { type AbstractDbxFirebaseOAuthConsentScopeViewComponent } from '../components/oauth.consent.scope.view.component';
import { DbxFirebaseOAuthConsentScopeDefaultViewComponent } from '../components/oauth.consent.scope.default.view.component';
import { type OAuthConsentScopesFormValue } from '../components/oauth.consent.scope.forms';

/**
 * OIDC scopes that cannot be deselected on the consent screen. `openid` is
 * mandatory for any OIDC flow, so the UI shows it as always-granted and the
 * server enforces it regardless of payload.
 */
const OAUTH_CONSENT_REQUIRED_SCOPES: readonly OidcScope[] = ['openid'];

/**
 * Configuration for `DbxOAuthConsentComponent`.
 */
export interface DbxOAuthConsentComponentConfig {
  /**
   * Component class for rendering the consent scope list.
   *
   * When not provided, falls back to the class configured in `DbxFirebaseOidcConfig`,
   * which itself defaults to `DbxFirebaseOAuthConsentScopeDefaultViewComponent`.
   */
  readonly consentScopeListViewClass?: Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>;
}

/**
 * Container component for the OIDC OAuth consent screen.
 *
 * Reads interaction UID and client details from route params (populated by
 * the server redirect), assembles them into `OAuthInteractionLoginDetails`,
 * and exposes Approve / Deny handlers that drive the view's nested
 * `dbxAction` contexts.
 *
 * Submission progress and error states are owned by the action stores; this
 * container is just routing-glue + handler factories.
 *
 * Supports ng-content projection — any content provided is passed through to
 * the view component for the `'no_user'` state (e.g. an app's login view).
 */
@Component({
  selector: 'dbx-firebase-oauth-consent',
  standalone: true,
  imports: [DbxFirebaseOAuthConsentViewComponent],
  template: `
    <dbx-firebase-oauth-consent-view [details]="resolvedDetails()" [consentStateCase]="consentStateCase()" [scopeInjectionConfig]="scopeInjectionConfig()" [requiredScopes]="requiredScopes" [approveHandler]="handleApprove" [denyHandler]="handleDeny">
      <ng-content />
    </dbx-firebase-oauth-consent-view>
  `,
  host: {
    class: 'd-block dbx-firebase-oauth-consent'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxOAuthConsentComponent implements OnDestroy {
  private readonly dbxRouterService = inject(DbxRouterService);
  private readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  private readonly interactionService = inject(DbxFirebaseOidcInteractionService);
  private readonly oidcConfigService = inject(DbxFirebaseOidcConfigService);

  // Config input
  readonly config = input<Maybe<DbxOAuthConsentComponentConfig>>();

  // Route param readers
  readonly interactionUidParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY);
  readonly clientIdParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_CLIENT_ID_PARAM_KEY);
  readonly clientNameParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY);
  readonly clientUriParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_CLIENT_URI_PARAM_KEY);
  readonly logoUriParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_LOGO_URI_PARAM_KEY);
  readonly scopesParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_SCOPES_PARAM_KEY);

  // Signals from route params
  private readonly routeUid = toSignal(this.interactionUidParamReader.value$);
  private readonly routeClientId = toSignal(this.clientIdParamReader.value$);
  private readonly routeClientName = toSignal(this.clientNameParamReader.value$);
  private readonly routeClientUri = toSignal(this.clientUriParamReader.value$);
  private readonly routeLogoUri = toSignal(this.logoUriParamReader.value$);
  private readonly routeScopes = toSignal(this.scopesParamReader.value$);

  // Auth state — undefined until Firebase resolves to avoid a flash between 'unknown' → 'no_user'/'user'
  readonly isLoggedIn: Signal<Maybe<boolean>> = toSignal(this.dbxFirebaseAuthService.isLoggedIn$);

  // Resolved values
  readonly resolvedInteractionUid = computed(() => this.routeUid());
  readonly resolvedDetails = computed<Maybe<OAuthInteractionLoginDetails>>(() => {
    const client_id = this.routeClientId() ?? '';
    const client_name = this.routeClientName();
    const client_uri = this.routeClientUri();
    const logo_uri = this.routeLogoUri();
    const scopes = this.routeScopes() ?? '';

    return {
      client_id,
      client_name,
      client_uri,
      logo_uri,
      scopes
    };
  });

  // Scope injection config: built from the configured scope list view class, falling back to config service, then the default
  readonly scopeInjectionConfig = computed<DbxInjectionComponentConfig>(() => ({
    componentClass: this.config()?.consentScopeListViewClass ?? this.oidcConfigService.consentScopeListViewClass ?? DbxFirebaseOAuthConsentScopeDefaultViewComponent
  }));

  /**
   * Scopes the user cannot deselect. Forwarded to the view, which shows
   * them as a static "Always granted" hint above the selection list.
   */
  readonly requiredScopes: readonly OidcScope[] = OAUTH_CONSENT_REQUIRED_SCOPES;

  readonly consentStateCase = computed<OidcConsentStateCase>(() => {
    const isLoggedIn = this.isLoggedIn();

    if (isLoggedIn === undefined) {
      return 'unknown';
    }

    if (!isLoggedIn) {
      return 'no_user';
    }

    return 'user';
  });

  ngOnDestroy(): void {
    this.interactionUidParamReader.destroy();
    this.clientIdParamReader.destroy();
    this.clientNameParamReader.destroy();
    this.clientUriParamReader.destroy();
    this.logoUriParamReader.destroy();
    this.scopesParamReader.destroy();
  }

  /**
   * Handles the Approve action. Pulls the form's selected scope array
   * straight off the form value (it already matches the API field name
   * `grantedOIDCScopes`) and forwards it through `submitConsent`. On a
   * successful response, hard-navigates to the OIDC server's redirect URL.
   */
  readonly handleApprove: WorkUsingContext<OAuthConsentScopesFormValue, OAuthInteractionConsentResponse> = (formValue, context) => {
    const uid = this.resolvedInteractionUid();

    if (!uid) {
      context.reject(new Error('Missing interaction UID'));
      return;
    }

    const grantedOIDCScopes = formValue.grantedOIDCScopes;

    context.startWorkingWithObservable(
      this.interactionService.submitConsent(uid, true, { grantedOIDCScopes }).pipe(
        tap((response) => {
          if (response.redirectTo) {
            globalThis.location.href = response.redirectTo;
          }
        })
      )
    );
  };

  /**
   * Handles the Deny action. No payload is sent — the server returns
   * `access_denied` to the OAuth client.
   */
  readonly handleDeny: WorkUsingContext<void, OAuthInteractionConsentResponse> = (_value, context) => {
    const uid = this.resolvedInteractionUid();

    if (!uid) {
      context.reject(new Error('Missing interaction UID'));
      return;
    }

    context.startWorkingWithObservable(
      this.interactionService.submitConsent(uid, false).pipe(
        tap((response) => {
          if (response.redirectTo) {
            globalThis.location.href = response.redirectTo;
          }
        })
      )
    );
  };
}
