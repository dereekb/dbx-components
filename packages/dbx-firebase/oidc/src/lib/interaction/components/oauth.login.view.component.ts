import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DbxBasicLoadingComponent, DbxErrorComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { type ErrorInput, type Maybe, readableError } from '@dereekb/util';

/**
 * State cases for the OIDC login interaction flow.
 */
export type OidcLoginStateCase = 'no_user' | 'user' | 'submitting' | 'error';

/**
 * Presentational component for the OIDC OAuth login interaction.
 *
 * Renders the login UI based on the current state case. Supports ng-content
 * projection to allow apps to provide a custom login view for the `'no_user'` state,
 * falling back to the default `<dbx-firebase-login>` component.
 *
 * @example
 * ```html
 * <dbx-firebase-oauth-login-view [loginStateCase]="'no_user'">
 *   <my-custom-login />
 * </dbx-firebase-oauth-login-view>
 * ```
 */
@Component({
  selector: 'dbx-firebase-oauth-login-view',
  standalone: true,
  imports: [DbxBasicLoadingComponent, DbxErrorComponent, DbxButtonComponent],
  template: `
    <div class="dbx-firebase-oauth-login-view">
      @switch (loginStateCase()) {
        @case ('no_user') {
          <ng-content></ng-content>
        }
        @case ('user') {
          <dbx-basic-loading [loading]="true" text="Signing in..."></dbx-basic-loading>
        }
        @case ('submitting') {
          <dbx-basic-loading [loading]="true" text="Submitting authentication..."></dbx-basic-loading>
        }
        @case ('error') {
          <dbx-button text="Retry" [raised]="true" (buttonClick)="retryClick.emit()"></dbx-button>
          <dbx-error [error]="resolvedError()"></dbx-error>
        }
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-firebase-oauth-login-view'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOAuthLoginViewComponent {
  readonly loginStateCase = input.required<OidcLoginStateCase>();
  readonly error = input<Maybe<string | ErrorInput>>();

  readonly resolvedError = computed<Maybe<ErrorInput>>(() => {
    const error = this.error();
    return typeof error === 'string' ? readableError('ERROR', error) : error;
  });

  readonly retryClick = output<void>();
}
