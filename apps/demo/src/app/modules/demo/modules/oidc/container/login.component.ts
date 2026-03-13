import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Transition } from '@uirouter/angular';
import { DbxFirebaseAuthService, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';
import { OAuthInteractionService } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DbxLinkComponent } from '@dereekb/dbx-web';
import { filter, first, switchMap, Subscription } from 'rxjs';

/**
 * Demo container component for the OIDC login interaction.
 *
 * When the user arrives (redirected from the OIDC provider), this component:
 * 1. If already authenticated — immediately retrieves the Firebase ID token and submits it.
 * 2. If not authenticated — shows the Firebase Auth login UI.
 * 3. After successful sign-in — retrieves the ID token and submits it.
 *
 * The server responds with a redirect to complete the OIDC flow.
 */
@Component({
  templateUrl: './login.component.html',
  standalone: true,
  imports: [DbxContentBoxDirective, DbxFirebaseLoginComponent, DbxFirebaseRegisterComponent, DbxFirebaseLoginTermsComponent, DbxLinkComponent]
})
export class DemoOidcLoginComponent implements OnInit, OnDestroy {
  private readonly transition = inject(Transition);
  private readonly authService = inject(DbxFirebaseAuthService);
  private readonly interactionService = inject(OAuthInteractionService);

  private _sub?: Subscription;

  mode: 'login' | 'register' = 'login';
  submitting = false;
  error: string | null = null;

  get uid(): string | null {
    return this.transition.params()['uid'] ?? null;
  }

  ngOnInit() {
    if (!this.uid) {
      this.error = 'Missing interaction UID.';
      return;
    }

    // Watch for auth state — when authenticated, submit the ID token
    this._sub = this.authService.isLoggedIn$
      .pipe(
        filter((loggedIn) => loggedIn),
        first(),
        switchMap(() => this.authService.idTokenString$.pipe(first()))
      )
      .subscribe({
        next: (idToken) => this._submitLogin(idToken),
        error: () => {
          this.error = 'Failed to retrieve authentication token.';
        }
      });
  }

  ngOnDestroy() {
    this._sub?.unsubscribe();
  }

  private _submitLogin(idToken: string): void {
    this.submitting = true;
    this.error = null;

    this.interactionService.submitLogin(this.uid!, idToken).subscribe({
      next: () => {
        // Server responds with a redirect — the browser follows it automatically
        this.submitting = false;
      },
      error: () => {
        this.submitting = false;
        this.error = 'Login failed. Please try again.';
      }
    });
  }
}
