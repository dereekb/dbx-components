import { ChangeDetectionStrategy, Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { OAuthInteractionService } from '../service/oidc-interaction.service';

/**
 * OAuth login component for OIDC interaction flow.
 *
 * Integrates with the existing Firebase Auth sign-in and redirects
 * back to the NestJS interaction endpoint with a Firebase ID token
 * as proof of authentication.
 *
 * Usage: Route to this component with `?uid=<interaction-uid>` query param.
 * After the user signs in via Firebase Auth, call `completeLogin(idToken)`.
 */
@Component({
  selector: 'dbx-firebase-oidc-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dbx-firebase-oidc-login">
      @if (error()) {
        <div class="dbx-firebase-oidc-login-error">
          <p>{{ error() }}</p>
        </div>
      }
      @if (loading()) {
        <p>Completing login...</p>
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-firebase-oidc-login'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxOAuthLoginComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly interactionService = inject(OAuthInteractionService);

  /**
   * The interaction UID. Can be provided as input or from query params.
   */
  readonly interactionUid = input<string>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private _uid: string | null = null;

  ngOnInit() {
    this._uid = this.interactionUid() ?? this.route.snapshot.queryParamMap.get('uid');
  }

  /**
   * Call this after the user has successfully signed in via Firebase Auth.
   * Pass the Firebase ID token to complete the OIDC login interaction.
   */
  completeLogin(idToken: string): void {
    if (!this._uid) {
      this.error.set('Missing interaction UID');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.interactionService.submitLogin(this._uid, idToken).subscribe({
      next: () => {
        this.loading.set(false);
        // The server will respond with a redirect
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Login failed. Please try again.');
      }
    });
  }
}
