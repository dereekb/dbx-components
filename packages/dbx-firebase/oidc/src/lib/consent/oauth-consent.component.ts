import { ChangeDetectionStrategy, Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { OAuthInteractionService } from '../service/oauth-interaction.service';

// MARK: Types
export interface OAuthConsentScope {
  readonly name: string;
  readonly description: string;
}

/**
 * OAuth consent screen component for OIDC interaction flow.
 *
 * Shows the client name, requested scopes, and what data will be shared.
 * Provides approve/deny buttons that POST to the NestJS interaction endpoint.
 */
@Component({
  selector: 'dbx-oauth-consent',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dbx-oauth-consent">
      @if (clientName()) {
        <h2>Authorize {{ clientName() }}</h2>
      }
      @if (scopes().length) {
        <p>This application is requesting access to:</p>
        <ul>
          @for (scope of scopes(); track scope.name) {
            <li>
              <strong>{{ scope.name }}</strong>
              @if (scope.description) {
                — {{ scope.description }}
              }
            </li>
          }
        </ul>
      }
      @if (error()) {
        <div class="dbx-oauth-consent-error">
          <p>{{ error() }}</p>
        </div>
      }
      @if (loading()) {
        <p>Processing...</p>
      } @else {
        <div class="dbx-oauth-consent-actions">
          <button (click)="approve()" [disabled]="loading()">Approve</button>
          <button (click)="deny()" [disabled]="loading()">Deny</button>
        </div>
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-oauth-consent'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxOAuthConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly interactionService = inject(OAuthInteractionService);

  readonly interactionUid = input<string>();
  readonly clientName = input<string>('');
  readonly scopes = input<OAuthConsentScope[]>([]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private _uid: string | null = null;

  ngOnInit() {
    this._uid = this.interactionUid() ?? this.route.snapshot.queryParamMap.get('uid');
  }

  approve(): void {
    this._submitConsent(true);
  }

  deny(): void {
    this._submitConsent(false);
  }

  private _submitConsent(approved: boolean): void {
    if (!this._uid) {
      this.error.set('Missing interaction UID');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.interactionService.submitConsent(this._uid, approved).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to process consent. Please try again.');
      }
    });
  }
}
