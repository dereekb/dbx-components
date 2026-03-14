import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxErrorComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { type ErrorInput, type Maybe, readableError } from '@dereekb/util';
import { type OAuthInteractionLoginDetails, type OidcScope } from '@dereekb/firebase';
import { SPACE_STRING_SPLIT_JOIN } from '@dereekb/util';
import { type DbxFirebaseOAuthConsentScopesViewData } from './oauth.consent.scope.view.component';

/**
 * Presentational component for the OIDC OAuth consent screen.
 *
 * Accepts an `OAuthInteractionLoginDetails` input that contains all client and scope
 * information. Renders the client name, logo, client URL, scopes (via `<dbx-injection>`),
 * error/loading states, and approve/deny action buttons.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-view
 *   [details]="loginDetails"
 *   [loading]="false"
 *   [scopeInjectionConfig]="scopeConfig"
 *   (approveClick)="onApprove()"
 *   (denyClick)="onDeny()">
 * </dbx-firebase-oauth-consent-view>
 * ```
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-view',
  standalone: true,
  imports: [DbxInjectionComponent, DbxAvatarComponent, DbxLoadingComponent, DbxErrorComponent, DbxButtonComponent, DbxButtonSpacerDirective],
  styleUrls: ['./oauth.consent.view.component.scss'],
  template: `
    <div class="dbx-firebase-oauth-consent-view">
      @if (loading()) {
        <dbx-loading [loading]="true" text="Processing..."></dbx-loading>
      } @else {
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
        @if (resolvedError()) {
          <dbx-error [error]="resolvedError()"></dbx-error>
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
  readonly loading = input<boolean>(false);
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

  readonly resolvedScopeInjectionConfig = computed<DbxInjectionComponentConfig>(() => {
    const data: DbxFirebaseOAuthConsentScopesViewData = {
      details: this.details(),
      scopes: this.scopes(),
      clientName: this.clientName()
    };

    return { ...this.scopeInjectionConfig(), data };
  });
}
