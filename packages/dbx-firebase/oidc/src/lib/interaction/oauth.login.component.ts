import { ChangeDetectionStrategy, Component, inject, input, computed, signal, effect, OnDestroy, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { dbxRouteParamReaderInstance, DbxRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService, DbxFirebaseLoginComponent } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcInteractionService } from '../service/oidc.interaction.service';
import { DbxFirebaseOidcConfigService } from '../service/oidc.configuration.service';
import { OidcInteractionUid } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

/**
 * State cases for the OIDC login interaction flow.
 */
export type OidcLoginStateCase = 'no_user' | 'user' | 'submitting' | 'error';

/**
 * OAuth login component for OIDC interaction flow.
 *
 * Integrates with existing Firebase Auth sign-in and redirects
 * back to the NestJS interaction endpoint with a Firebase ID token
 * as proof of authentication.
 *
 * Usage: Route to this component with `?uid=<interaction-uid>` query param.
 *
 * State flow:
 * - `no_user`: Not logged in — shows `<dbx-firebase-login>` for sign-in.
 * - `user`: Logged in — auto-submits Firebase ID token to complete the interaction.
 * - `submitting`: Token submission in progress — shows loading state.
 * - `error`: Submission failed — shows error with retry option.
 */
@Component({
  selector: 'dbx-firebase-oauth-login',
  standalone: true,
  imports: [CommonModule, DbxFirebaseLoginComponent],
  template: `
    <div class="dbx-firebase-oauth-login">
      @switch (loginStateCase()) {
        @case ('no_user') {
          <dbx-firebase-login />
        }
        @case ('user') {
          <p>Signing in...</p>
        }
        @case ('submitting') {
          <p>Submitting authentication...</p>
        }
        @case ('error') {
          <div class="dbx-firebase-oauth-login-error">
            <p>{{ errorMessage() }}</p>
            <button (click)="retry()">Retry</button>
          </div>
        }
      }
    </div>
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
  private readonly oidcConfigService = inject(DbxFirebaseOidcConfigService);

  /**
   * Optional override for the route param key that holds the interaction UID.
   */
  readonly paramKey = input<string>();

  readonly uidParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, this.oidcConfigService.oidcInteractionUidParamKey);

  readonly interactionUid: Signal<Maybe<OidcInteractionUid>> = toSignal(this.uidParamReader.value$);
  readonly isLoggedIn = toSignal(this.dbxFirebaseAuthService.isLoggedIn$, { initialValue: false });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginStateCase = computed<OidcLoginStateCase>(() => {
    if (this.submitting()) {
      return 'submitting';
    }

    if (this.errorMessage()) {
      return 'error';
    }

    if (!this.isLoggedIn()) {
      return 'no_user';
    }

    return 'user';
  });

  constructor() {
    // Update param key when input changes
    effect(() => {
      const key = this.paramKey();

      if (key) {
        this.uidParamReader.setParamKey(key);
      }
    });

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
        this.submitting.set(false);

        if (response.redirectTo) {
          window.location.href = response.redirectTo;
        }
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Failed to complete login. Please try again.');
      }
    });
  }
}
