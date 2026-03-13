import { ChangeDetectionStrategy, Component, inject, input, computed, signal, effect, OnDestroy, type Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { dbxRouteParamReaderInstance, DbxRouterService, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxFirebaseOidcInteractionService } from '../../service/oidc.interaction.service';
import { DbxFirebaseOidcConfigService } from '../../service/oidc.configuration.service';
import { type OidcScope } from '@dereekb/firebase';
import { type Maybe, splitCommaSeparatedString } from '@dereekb/util';
import { DbxFirebaseOAuthConsentViewComponent } from '../components/oauth.consent.view.component';
import { type AbstractDbxFirebaseOAuthConsentScopeViewComponent } from '../components/oauth.consent.scope.view.component';
import { DbxFirebaseOAuthConsentScopeDefaultViewComponent } from '../components/oauth.consent.scope.default.view.component';

/**
 * Configuration for `DbxOAuthConsentComponent`.
 */
export interface DbxOAuthConsentComponentConfig {
  /**
   * Component class for rendering the consent scope list.
   *
   * When not provided, falls back to the class configured in `DbxFirebaseOidcConfig`,
   * which itself defaults to `DbxFirebaseOAuthConsentScopeDefaultViewComponent`.
   */
  readonly consentScopeListViewClass?: Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>;
}

/**
 * Container component for the OIDC OAuth consent screen.
 *
 * Manages all state: route param reading, consent submission, and error handling.
 * Delegates visual rendering to `DbxFirebaseOAuthConsentViewComponent`.
 *
 * Reads interaction UID, client name, and scopes from route params (populated by
 * the server redirect). Inputs can optionally override route param values.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent',
  standalone: true,
  imports: [DbxFirebaseOAuthConsentViewComponent],
  template: `
    <dbx-firebase-oauth-consent-view [clientName]="resolvedClientName()" [scopes]="resolvedScopes()" [loading]="loading()" [error]="error()" [scopeInjectionConfig]="scopeInjectionConfig()" (approveClick)="approve()" (denyClick)="deny()"></dbx-firebase-oauth-consent-view>
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

  // Config input
  readonly config = input<Maybe<DbxOAuthConsentComponentConfig>>();

  // Optional input overrides
  readonly interactionUid = input<string>();
  readonly clientName = input<string>();
  readonly scopes = input<OidcScope[]>();

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
  readonly resolvedScopes = computed<OidcScope[]>(() => this.scopes() ?? splitCommaSeparatedString(this.routeScopes() ?? ''));

  // Scope injection config: built from the configured scope list view class, falling back to config service, then the default
  readonly scopeInjectionConfig = computed<DbxInjectionComponentConfig>(() => ({
    componentClass: this.config()?.consentScopeListViewClass ?? this.oidcConfigService.consentScopeListViewClass ?? DbxFirebaseOAuthConsentScopeDefaultViewComponent
  }));

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
