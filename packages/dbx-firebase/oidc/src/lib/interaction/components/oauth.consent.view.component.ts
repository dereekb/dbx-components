import { ChangeDetectionStrategy, Component, computed, input, type Signal } from '@angular/core';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxAvatarComponent, DbxBasicLoadingComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxActionSnackbarErrorDirective } from '@dereekb/dbx-web';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe, SPACE_STRING_SPLIT_JOIN } from '@dereekb/util';
import { type OAuthInteractionConsentResponse, type OAuthInteractionLoginDetails, type OidcScope } from '@dereekb/firebase';
import { type DbxFirebaseOAuthConsentScopesViewData } from './oauth.consent.scope.view.component';
import { type OAuthConsentScopesFormValue } from './oauth.consent.scope.forms';

/**
 * Default required scopes — `openid` is mandatory for any OIDC flow, so the
 * UI always treats it as not-deselectable.
 */
const DEFAULT_OAUTH_CONSENT_REQUIRED_SCOPES: readonly OidcScope[] = ['openid'];

/**
 * State cases for the OIDC consent interaction flow.
 *
 * - `'unknown'` — Firebase auth state has not yet resolved. Render a spinner
 *   to avoid flashing between states.
 * - `'no_user'` — Auth resolved and there is no signed-in user. Project the
 *   login UI via ng-content.
 * - `'user'` — Auth resolved and a user is signed in. Render the consent
 *   form. Submission progress and errors are managed by the inner
 *   `dbxAction` contexts and surfaced via `dbxActionSnackbarError`.
 */
export type OidcConsentStateCase = 'unknown' | 'no_user' | 'user';

/**
 * Presentational component for the OIDC OAuth consent screen.
 *
 * Wires up two `dbxAction` contexts — an outer one for Approve (which hosts
 * the scope-selection forge form via `dbxActionForm`) and a nested one for
 * Deny (which carries no value). Buttons are bound by Angular DI's
 * nearest-ancestor lookup: the Approve button picks up the outer action, the
 * Deny button (wrapped in its own `<ng-container dbxAction>`) picks up the
 * inner.
 *
 * Supports ng-content projection — anything provided is rendered for the
 * `'no_user'` state (so apps can project a login view, mirroring
 * `DbxFirebaseOAuthLoginViewComponent`).
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-view
 *   [details]="loginDetails"
 *   [consentStateCase]="'user'"
 *   [scopeInjectionConfig]="scopeConfig"
 *   [approveHandler]="handleApprove"
 *   [denyHandler]="handleDeny">
 * </dbx-firebase-oauth-consent-view>
 * ```
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-view',
  standalone: true,
  imports: [DbxInjectionComponent, DbxAvatarComponent, DbxBasicLoadingComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionButtonDirective, DbxActionSnackbarErrorDirective],
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
          @if (clientName()) {
            <p class="dbx-firebase-oauth-consent-prompt">
              <strong>{{ clientName() }}</strong>
              is requesting these permissions:
            </p>
          }

          <div dbxAction dbxActionSnackbarError [dbxActionHandler]="approveHandler()">
            <dbx-injection [config]="resolvedScopeInjectionConfig()"></dbx-injection>

            <div class="dbx-pt3 dbx-pb3 dbx-firebase-oauth-consent-actions">
              <dbx-button dbxActionButton text="Approve" [raised]="true" color="primary"></dbx-button>
              <dbx-button-spacer></dbx-button-spacer>
              <ng-container dbxAction dbxActionSnackbarError dbxActionValue [dbxActionHandler]="denyHandler()">
                <dbx-button dbxActionButton text="Deny" [flat]="true" color="warn"></dbx-button>
              </ng-container>
            </div>
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
  readonly scopeInjectionConfig = input.required<DbxInjectionComponentConfig>();
  /**
   * Scopes that cannot be deselected by the user. Forwarded to the scope
   * view so it can render an "Always granted" hint. Defaults to `['openid']`.
   */
  readonly requiredScopes = input<readonly OidcScope[]>(DEFAULT_OAUTH_CONSENT_REQUIRED_SCOPES);

  /**
   * Approve handler — called with the form value when the Approve button
   * triggers the outer action. Receives a `WorkUsingContext` to drive the
   * action's loading/success/error pipeline.
   */
  readonly approveHandler = input.required<WorkUsingContext<OAuthConsentScopesFormValue, OAuthInteractionConsentResponse>>();

  /**
   * Deny handler — called when the Deny button triggers the inner action.
   * No value is passed (`dbxActionValue` provides an empty payload).
   */
  readonly denyHandler = input.required<WorkUsingContext<void, OAuthInteractionConsentResponse>>();

  readonly clientName = computed(() => this.details()?.client_name ?? '');
  readonly clientUri = computed(() => this.details()?.client_uri);
  readonly logoUri = computed(() => this.details()?.logo_uri);
  readonly scopes: Signal<OidcScope[]> = computed(() => SPACE_STRING_SPLIT_JOIN.splitStrings(this.details()?.scopes ?? ''));

  readonly resolvedScopeInjectionConfig = computed<DbxInjectionComponentConfig>(() => {
    const data: DbxFirebaseOAuthConsentScopesViewData = {
      details: this.details(),
      scopes: this.scopes(),
      clientName: this.clientName(),
      requiredScopes: this.requiredScopes()
    };

    return { ...this.scopeInjectionConfig(), data };
  });
}
