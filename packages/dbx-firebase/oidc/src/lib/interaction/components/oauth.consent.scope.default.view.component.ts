import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AbstractDbxFirebaseOAuthConsentScopeViewComponent } from './oauth.consent.scope.view.component';
import { DbxFirebaseOAuthConsentScopeListComponent } from './oauth.consent.scope.list.component';
import { type OAuthConsentScope } from './oauth.consent.scope';
import { DbxFirebaseOidcConfigService } from '../../service/oidc.configuration.service';
import { separateValues } from '@dereekb/util';

/**
 * Default consent scope view component that maps scope names to descriptions
 * using the `OidcScopeDetails` from the app-level OIDC configuration.
 *
 * Apps can override this by providing a custom `consentScopeListViewClass`
 * in `DbxFirebaseOidcConfig` or `DbxOAuthConsentComponentConfig`.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-default-view',
  standalone: true,
  imports: [DbxFirebaseOAuthConsentScopeListComponent],
  template: `
    <p>
      <strong>{{ clientName() }}</strong>
      is requesting these permissions:
    </p>
    <dbx-firebase-oauth-consent-scope-list [scopes]="mappedScopes()"></dbx-firebase-oauth-consent-scope-list>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOAuthConsentScopeDefaultViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {
  private readonly oidcConfigService = inject(DbxFirebaseOidcConfigService);

  readonly mappedScopes = computed<OAuthConsentScope[]>(() => {
    const availableScopes = this.oidcConfigService.availableScopes;
    const availableScopeValues = new Set(availableScopes.map((s) => s.value));
    const { included: knownScopes, excluded: unknownScopes } = separateValues(this.scopes(), (name) => availableScopeValues.has(name));

    return [
      ...knownScopes.map((name) => {
        const details = availableScopes.find((s) => s.value === name);
        return { name, description: details?.description ?? '' };
      }),
      ...unknownScopes.map((name) => ({ name, description: 'unknown' }))
    ];
  });
}
