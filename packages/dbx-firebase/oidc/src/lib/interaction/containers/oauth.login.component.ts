import { Component, inject, computed, signal, effect, type Signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { clean, dbxRouteParamReaderInstance, DbxRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcInteractionService } from '../../service/oidc.interaction.service';
import { DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY } from '../../service/oidc.configuration.service';
import { type OidcInteractionUid } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OidcLoginStateCase, DbxFirebaseOAuthLoginViewComponent } from '../components/oauth.login.view.component';

/**
 * Notice shown over the login UI after the server refused the signed-in user's ID token.
 */
export const OIDC_LOGIN_SESSION_REJECTED_NOTICE = 'Your previous sign-in is no longer valid. Please sign in again.';

/**
 * Container component for the OIDC OAuth login interaction flow.
 *
 * Manages all state: route param reading, Firebase Auth observation, ID token
 * submission, and error handling. Delegates visual rendering to
 * `DbxFirebaseOAuthLoginViewComponent`.
 *
 * Supports ng-content projection — any content provided is passed through to
 * the view component, replacing the default `<dbx-firebase-login>` for the
 * `'no_user'` state.
 *
 * Usage: Route to this component with `?uid=<interaction-uid>` query param.
 */
@Component({
  selector: 'dbx-firebase-oauth-login',
  imports: [DbxFirebaseOAuthLoginViewComponent],
  template: `
    <dbx-firebase-oauth-login-view [loginStateCase]="loginStateCaseSignal()" [error]="errorMessage()" [notice]="notice()" (retryClick)="retry()">
      <ng-content />
    </dbx-firebase-oauth-login-view>
  `,
  host: {
    class: 'd-block dbx-firebase-oauth-login'
  }
})
export class DbxFirebaseOAuthLoginComponent {
  private readonly dbxRouterService = inject(DbxRouterService);
  private readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  private readonly interactionService = inject(DbxFirebaseOidcInteractionService);
  readonly uidParamReader = clean(dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY));

  readonly interactionUid: Signal<Maybe<OidcInteractionUid>> = toSignal(this.uidParamReader.value$);
  readonly isLoggedIn: Signal<Maybe<boolean>> = toSignal(this.dbxFirebaseAuthService.isLoggedIn$);

  readonly submitting = signal(false);
  readonly errorMessage = signal<Maybe<string>>(null);
  readonly notice = signal<Maybe<string>>(null);

  readonly loginStateCaseSignal = computed<OidcLoginStateCase>(() => {
    const errorMessage = this.errorMessage();
    const isLoggedIn = this.isLoggedIn();
    let result: OidcLoginStateCase;

    if (this.submitting()) {
      result = 'submitting';
    } else if (errorMessage) {
      result = 'error';
    } else {
      if (isLoggedIn === undefined) {
        result = 'unknown';
      } else if (isLoggedIn) {
        result = 'user';
      } else {
        result = 'no_user';
      }
    }

    return result;
  });

  constructor() {
    // Auto-submit when user is logged in
    effect(() => {
      if (this.loginStateCaseSignal() === 'user') {
        this._submitIdToken();
      }
    });
  }

  retry(): void {
    this.errorMessage.set(null);
    this._submitIdToken();
  }

  private _submitIdToken(): void {
    const uid = this.interactionUid();

    if (!uid) {
      this.errorMessage.set('Missing interaction UID from route parameters.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.notice.set(null);

    this.interactionService.submitLogin(uid).subscribe({
      next: (response) => {
        if (response.redirectTo) {
          // Leave `submitting` true so the auto-submit effect cannot re-enter
          // and fire another `submitLogin` POST while the browser navigates.
          window.location.href = response.redirectTo;
        } else {
          this.submitting.set(false);
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // The server could not verify the ID token: the Firebase session the browser holds is one it will
          // not accept (expired, revoked, or issued by an Auth instance the server no longer knows — an
          // emulator restart does this). A retry resubmits the same token and can never succeed, so sign out
          // instead: `isLoggedIn` flips to false, the login UI surfaces, and a fresh sign-in re-triggers the
          // auto-submit with a token the server can verify.
          //
          // Should the sign-out itself fail the user is still logged in, and clearing `submitting` would return
          // the state to `'user'` and re-fire the auto-submit — so that case lands in the error state instead.
          this.dbxFirebaseAuthService
            .logOut()
            .then(
              () => this.notice.set(OIDC_LOGIN_SESSION_REJECTED_NOTICE),
              () => this.errorMessage.set('Failed to complete login. Please try again.')
            )
            .finally(() => this.submitting.set(false));
        } else {
          this.submitting.set(false);
          this.errorMessage.set('Failed to complete login. Please try again.');
        }
      }
    });
  }
}
