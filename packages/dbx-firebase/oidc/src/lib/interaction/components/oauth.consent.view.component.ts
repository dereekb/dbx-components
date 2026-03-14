import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxBasicLoadingComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxErrorComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { type ErrorInput, type Maybe, readableError } from '@dereekb/util';
import { type OidcScope } from '@dereekb/firebase';
import { type DbxFirebaseOAuthConsentScopesViewData } from './oauth.consent.scope.view.component';

/**
 * Presentational component for the OIDC OAuth consent screen.
 *
 * Renders the client name, scopes (via `<dbx-injection>`), error/loading states,
 * and approve/deny action buttons. The scope rendering is always delegated to a
 * component provided via `scopeInjectionConfig`.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-consent-view
 *   [clientName]="'My App'"
 *   [scopes]="scopes"
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
  imports: [DbxInjectionComponent, DbxLoadingComponent, DbxErrorComponent, DbxButtonComponent, DbxButtonSpacerDirective],
  template: `
    <div class="dbx-firebase-oauth-consent-view">
      @if (loading()) {
        <dbx-loading [loading]="true" text="Processing..."></dbx-loading>
      } @else {
        @if (clientName()) {
          <h2>Authorize {{ clientName() }}</h2>
        }
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
  readonly clientName = input<string>('');
  readonly scopes = input<OidcScope[]>([]);
  readonly loading = input<boolean>(false);
  readonly error = input<Maybe<string | ErrorInput>>();
  readonly scopeInjectionConfig = input.required<DbxInjectionComponentConfig>();

  readonly resolvedError = computed<Maybe<ErrorInput>>(() => {
    const error = this.error();
    return typeof error === 'string' ? readableError('ERROR', error) : error;
  });

  readonly approveClick = output<void>();
  readonly denyClick = output<void>();

  readonly resolvedScopeInjectionConfig = computed<DbxInjectionComponentConfig>(() => {
    const data: DbxFirebaseOAuthConsentScopesViewData = {
      scopes: this.scopes(),
      clientName: this.clientName()
    };

    return { ...this.scopeInjectionConfig(), data };
  });
}
