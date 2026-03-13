import { ChangeDetectionStrategy, Component, inject, input, computed, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { dbxRouteParamReaderInstance, DbxRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseOidcInteractionService } from '../service/oidc.interaction.service';
import { DbxFirebaseOidcConfigService } from '../service/oidc.configuration.service';

// MARK: Types
export interface OAuthConsentScope {
  readonly name: string;
  readonly description: string;
}

/**
 * Parses a scopes string (comma-separated or JSON array) into OAuthConsentScope[].
 *
 * Supported formats:
 * - Comma-separated: "openid,profile,email"
 * - JSON array: '[{"name":"openid","description":"OpenID"}]'
 */
export function parseOAuthConsentScopes(scopesString: string | undefined | null): OAuthConsentScope[] {
  if (!scopesString) {
    return [];
  }

  const trimmed = scopesString.trim();

  // Try JSON parse first
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as OAuthConsentScope[];
    } catch {
      // Fall through to comma-separated parsing
    }
  }

  // Comma-separated scope names
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name, description: '' }));
}

/**
 * OAuth consent screen component for OIDC interaction flow.
 *
 * Reads interaction UID, client name, and scopes from route params (populated by
 * the server redirect). Inputs can optionally override route param values.
 *
 * Shows the client name, requested scopes, and provides approve/deny buttons
 * that POST to the NestJS interaction endpoint.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dbx-firebase-oauth-consent">
      @if (resolvedClientName()) {
        <h2>Authorize {{ resolvedClientName() }}</h2>
      }
      @if (resolvedScopes().length) {
        <p>This application is requesting access to:</p>
        <ul>
          @for (scope of resolvedScopes(); track scope.name) {
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
        <div class="dbx-firebase-oauth-consent-error">
          <p>{{ error() }}</p>
        </div>
      }
      @if (loading()) {
        <p>Processing...</p>
      } @else {
        <div class="dbx-firebase-oauth-consent-actions">
          <button (click)="approve()" [disabled]="loading()">Approve</button>
          <button (click)="deny()" [disabled]="loading()">Deny</button>
        </div>
      }
    </div>
  `,
  host: {
    class: 'd-block dbx-firebase-oauth-consent'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxOAuthConsentComponent implements OnDestroy {
  private readonly dbxRouterService = inject(DbxRouterService);
  private readonly interactionService = inject(DbxFirebaseOidcInteractionService);
  private readonly oidcConfigService = inject(DbxFirebaseOidcConfigService);

  // Optional input overrides
  readonly interactionUid = input<string>();
  readonly clientName = input<string>();
  readonly scopes = input<OAuthConsentScope[]>();

  // Param key inputs for customization
  readonly uidParamKey = input<string>();
  readonly clientNameParamKey = input<string>();
  readonly scopesParamKey = input<string>();

  // Route param readers
  readonly uidParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, this.oidcConfigService.oidcInteractionUidParamKey);
  readonly clientNameParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, this.oidcConfigService.clientNameParamKey);
  readonly scopesParamReader = dbxRouteParamReaderInstance<string>(this.dbxRouterService, this.oidcConfigService.scopesParamKey);

  // Signals from route params
  private readonly routeUid = toSignal(this.uidParamReader.value$);
  private readonly routeClientName = toSignal(this.clientNameParamReader.value$);
  private readonly routeScopes = toSignal(this.scopesParamReader.value$);

  // Resolved values: input overrides route param
  readonly resolvedUid = computed(() => this.interactionUid() ?? this.routeUid());
  readonly resolvedClientName = computed(() => this.clientName() ?? this.routeClientName() ?? '');
  readonly resolvedScopes = computed<OAuthConsentScope[]>(() => this.scopes() ?? parseOAuthConsentScopes(this.routeScopes()));

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Update param keys when inputs change
    effect(() => {
      const key = this.uidParamKey();

      if (key) {
        this.uidParamReader.setParamKey(key);
      }
    });

    effect(() => {
      const key = this.clientNameParamKey();

      if (key) {
        this.clientNameParamReader.setParamKey(key);
      }
    });

    effect(() => {
      const key = this.scopesParamKey();

      if (key) {
        this.scopesParamReader.setParamKey(key);
      }
    });
  }

  ngOnDestroy(): void {
    this.uidParamReader.destroy();
    this.clientNameParamReader.destroy();
    this.scopesParamReader.destroy();
  }

  approve(): void {
    this._submitConsent(true);
  }

  deny(): void {
    this._submitConsent(false);
  }

  private _submitConsent(approved: boolean): void {
    const uid = this.resolvedUid();

    if (!uid) {
      this.error.set('Missing interaction UID');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.interactionService.submitConsent(uid, approved).subscribe({
      next: (response) => {
        this.loading.set(false);

        if (response.redirectTo) {
          window.location.href = response.redirectTo;
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to process consent. Please try again.');
      }
    });
  }
}
