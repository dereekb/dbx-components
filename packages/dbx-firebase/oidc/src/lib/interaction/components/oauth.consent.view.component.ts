import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxAvatarComponent, DbxBasicLoadingComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxErrorComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { type ErrorInput, type Maybe, readableError, SPACE_STRING_SPLIT_JOIN } from '@dereekb/util';
import { type OAuthInteractionLoginDetails, type OidcScope } from '@dereekb/firebase';
import { type DbxFirebaseOAuthConsentScopesViewData } from './oauth.consent.scope.view.component';

/**
 * State cases for the OIDC consent interaction flow.
 *
 * - `'unknown'` — Firebase auth state has not yet resolved. Render nothing/spinner to avoid flashing.
 * - `'no_user'` — Auth resolved and there is no signed-in user. Project the login UI via ng-content.
 * - `'user'` — Auth resolved and a user is signed in. Render the consent form.
 * - `'submitting'` — Submitting the consent decision to the OIDC interaction endpoint.
 * - `'error'` — Submission failed; allow retry.
 */
export type OidcConsentStateCase = 'unknown' | 'no_user' | 'user' | 'submitting' | 'error';

/**
 * Presentational component for the OIDC OAuth consent screen.
 *
 * Accepts an `OAuthInteractionLoginDetails` input that contains all client and scope
 * information. Renders the client name, logo, client URL, scopes (via `<dbx-injection>`),
 * error/loading states, and approve/deny action buttons.
 *
 * Supports ng-content projection — content provided is rendered for the `'no_user'` state
 * (so apps can project a login view, mirroring `DbxFirebaseOAuthLoginViewComponent`).
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-view
 *   [details]="loginDetails"
 *   [consentStateCase]="'user'"
 *   [scopeInjectionConfig]="scopeConfig"
 *   (approveClick)="onApprove()"
 *   (denyClick)="onDeny()">
 * </dbx-firebase-oauth-consent-view>
 * ```
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-view',
  standalone: true,
  imports: [DbxInjectionComponent, DbxAvatarComponent, DbxBasicLoadingComponent, DbxLoadingComponent, DbxErrorComponent, DbxButtonComponent, DbxButtonSpacerDirective],
  styleUrls: ['./oauth.consent.view.component.scss'],
  template: `
    <div class="dbx-firebase-oauth-consent-view">
      @switch (consentStateCase()) {
        @case ('unknown') {
          <dbx-basic-loading [loading]="true"></dbx-basic-loading>
        }
        @case ('no_user') {
          <ng-content></ng-content>
        }
        @case ('submitting') {
          <dbx-loading [loading]="true" text="Processing..."></dbx-loading>
        }
        @case ('error') {
          <dbx-button text="Retry" [raised]="true" (buttonClick)="retryClick.emit()"></dbx-button>
          <dbx-error [error]="resolvedError()"></dbx-error>
        }
        @case ('user') {
          <div class="dbx-firebase-oauth-consent-header">
            @if (clientName()) {
              <h2>You're signing in to {{ clientName() }}</h2>
            }
            <div class="dbx-firebase-oauth-consent-header-info dbx-flex">
              <dbx-avatar [avatarUrl]="logoUri()" [avatarStyle]="'square'" avatarIcon="apps"></dbx-avatar>
              <span>
                @if (clientUri()) {
                  <a class="dbx-firebase-oauth-consent-client-uri" [href]="clientUri()" target="_blank" rel="noopener noreferrer">{{ clientUri() }}</a>
                }
              </span>
            </div>
          </div>
          <dbx-injection [config]="resolvedScopeInjectionConfig()"></dbx-injection>
          <div class="dbx-pt3 dbx-pb3 dbx-firebase-oauth-consent-actions">
            <dbx-button text="Approve" [raised]="true" color="primary" (buttonClick)="approveClick.emit()"></dbx-button>
            <dbx-button-spacer></dbx-button-spacer>
            <dbx-button text="Deny" [flat]="true" color="warn" (buttonClick)="denyClick.emit()"></dbx-button>
          </div>
        }
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-firebase-oauth-consent-view'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOAuthConsentViewComponent {
  readonly details = input<Maybe<OAuthInteractionLoginDetails>>();
  readonly consentStateCase = input.required<OidcConsentStateCase>();
  readonly error = input<Maybe<string | ErrorInput>>();
  readonly scopeInjectionConfig = input.required<DbxInjectionComponentConfig>();

  readonly clientName = computed(() => this.details()?.client_name ?? '');
  readonly clientUri = computed(() => this.details()?.client_uri);
  readonly logoUri = computed(() => this.details()?.logo_uri);
  readonly scopes = computed<OidcScope[]>(() => SPACE_STRING_SPLIT_JOIN.splitStrings(this.details()?.scopes ?? ''));

  readonly resolvedError = computed<Maybe<ErrorInput>>(() => {
    const error = this.error();
    return typeof error === 'string' ? readableError('ERROR', error) : error;
  });

  readonly approveClick = output<void>();
  readonly denyClick = output<void>();
  readonly retryClick = output<void>();

  readonly resolvedScopeInjectionConfig = computed<DbxInjectionComponentConfig>(() => {
    const data: DbxFirebaseOAuthConsentScopesViewData = {
      details: this.details(),
      scopes: this.scopes(),
      clientName: this.clientName()
    };

    return { ...this.scopeInjectionConfig(), data };
  });
}
