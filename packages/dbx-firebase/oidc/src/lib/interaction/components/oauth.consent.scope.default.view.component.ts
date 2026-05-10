import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { type OidcScope } from '@dereekb/firebase';
import { separateValues } from '@dereekb/util';
import { DbxFirebaseOidcConfigService } from '../../service/oidc.configuration.service';
import { type DbxFirebaseOAuthConsentScopesViewData } from './oauth.consent.scope.view.component';
import { type OAuthConsentScope } from './oauth.consent.scope';
import { type OAuthConsentScopesFormFieldsConfig } from './oauth.consent.scope.forms';
import { DbxFirebaseOAuthConsentScopeFormComponent } from './oauth.consent.scope.form.component';

/**
 * Default consent scope view component.
 *
 * Reads the requested scopes (and required scopes) from the
 * `DBX_INJECTION_COMPONENT_DATA` provided by the parent consent view,
 * resolves human-readable descriptions from the app-level
 * `DbxFirebaseOidcConfigService`, then renders a
 * `DbxFirebaseOAuthConsentScopeFormComponent` with `dbxActionForm` so the
 * form's value participates in the surrounding `dbxAction` (the consent
 * view's outer Approve action).
 *
 * Required scopes are not user-selectable. They are surfaced as an "Always
 * granted" hint above the form because the server enforces them regardless
 * of payload — including them in the selection list would just add noise.
 *
 * Apps can override this default via
 * `DbxFirebaseOidcConfig.consentScopeListViewClass` or
 * `DbxOAuthConsentComponentConfig.consentScopeListViewClass`. Custom views
 * should similarly apply `dbxActionForm` to a forge form whose value matches
 * `OAuthConsentScopesFormValue`.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-default-view',
  template: `
    @if (alwaysGrantedLabel(); as label) {
      <p class="dbx-firebase-oauth-consent-always-granted dbx-hint">Always granted: {{ label }}</p>
    }
    <dbx-firebase-oauth-consent-scope-form dbxActionForm [config]="formFieldsConfig()"></dbx-firebase-oauth-consent-scope-form>
  `,
  imports: [DbxFirebaseOAuthConsentScopeFormComponent, DbxActionFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOAuthConsentScopeDefaultViewComponent {
  private readonly _oidcConfigService = inject(DbxFirebaseOidcConfigService);
  private readonly _data = inject<DbxFirebaseOAuthConsentScopesViewData>(DBX_INJECTION_COMPONENT_DATA);

  readonly mappedScopes = computed<OAuthConsentScope[]>(() => {
    const availableScopes = this._oidcConfigService.availableScopes;
    const availableScopeValues = new Set(availableScopes.map((s) => s.value));
    const { included: knownScopes, excluded: unknownScopes } = separateValues(this._data.scopes, (name) => availableScopeValues.has(name));

    return [
      ...knownScopes.map((name) => {
        const details = availableScopes.find((s) => s.value === name);
        return { name, description: details?.description ?? '' };
      }),
      ...unknownScopes.map((name) => ({ name, description: 'unknown' }))
    ];
  });

  readonly optionalScopes = computed<OAuthConsentScope[]>(() => {
    const requiredSet = new Set<OidcScope>(this._data.requiredScopes ?? []);
    return this.mappedScopes().filter((scope) => !requiredSet.has(scope.name));
  });

  readonly alwaysGrantedLabel = computed<string | null>(() => {
    const required = this._data.requiredScopes ?? [];
    return required.length > 0 ? required.join(', ') : null;
  });

  readonly formFieldsConfig = computed<OAuthConsentScopesFormFieldsConfig>(() => ({
    optionalScopes: this.optionalScopes()
  }));
}
