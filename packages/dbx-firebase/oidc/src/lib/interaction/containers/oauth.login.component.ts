import { ChangeDetectionStrategy, Component, inject, computed, signal, effect, type OnDestroy, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { dbxRouteParamReaderInstance, DbxRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcInteractionService } from '../../service/oidc.interaction.service';
import { DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY } from '../../service/oidc.configuration.service';
import { type OidcInteractionUid } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OidcLoginStateCase, DbxFirebaseOAuthLoginViewComponent } from '../components/oauth.login.view.component';

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
  standalone: true,
  imports: [DbxFirebaseOAuthLoginViewComponent],
  template: `
    <dbx-firebase-oauth-login-view [loginStateCase]="loginStateCase()" [error]="errorMessage()" (retryClick)="retry()">
      <ng-content />
    </dbx-firebase-oauth-login-view>
  `,
  host: {
    class: 'd-block dbx-firebase-oauth-login'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOAuthLoginComponent implements OnDestroy {
  private readonly dbxRouterService = inject(DbxRouterService);
  private readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  private readonly interactionService = inject(DbxFirebaseOidcInteractionService);
  readonly uidParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY);

  readonly interactionUid: Signal<Maybe<OidcInteractionUid>> = toSignal(this.uidParamReader.value$);
  readonly isLoggedIn: Signal<Maybe<boolean>> = toSignal(this.dbxFirebaseAuthService.isLoggedIn$);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginStateCase = computed<OidcLoginStateCase>(() => {
    if (this.submitting()) {
      return 'submitting';
    }

    if (this.errorMessage()) {
      return 'error';
    }

    const isLoggedIn = this.isLoggedIn();

    if (isLoggedIn === undefined) {
      return 'unknown';
    }

    if (!isLoggedIn) {
      return 'no_user';
    }

    return 'user';
  });

  constructor() {
    // Auto-submit when user is logged in
    effect(() => {
      if (this.loginStateCase() === 'user') {
        this._submitIdToken();
      }
    });
  }

  ngOnDestroy(): void {
    this.uidParamReader.destroy();
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
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Failed to complete login. Please try again.');
      }
    });
  }
}
