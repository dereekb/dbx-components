import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { type Maybe, separateValues } from '@dereekb/util';
import { type ClickableAnchor, DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { DbxContentPitDirective, type DbxContentPitScrollableInput, DbxLinkComponent } from '@dereekb/dbx-web';
import { type OidcScope } from '@dereekb/firebase';
import { DbxFirebaseOidcConfigService } from '../../service/oidc.configuration.service';
import { type DbxFirebaseOAuthConsentScopesViewData } from './oauth.consent.scope.view.component';
import { type OAuthConsentScope } from './oauth.consent.scope';
import { type OAuthConsentScopesFormFieldsConfig } from './oauth.consent.scope.forms';
import { DbxFirebaseOAuthConsentScopeFormComponent } from './oauth.consent.scope.form.component';

/**
 * Height cap applied to the scope pit while the selection list is expanded. Bounds a long
 * scope list so it scrolls inside the pit instead of pushing the consent screen's
 * Approve/Deny buttons below the fold on small screens.
 */
const OAUTH_CONSENT_SCOPES_PIT_SCROLLABLE_HEIGHT: DbxContentPitScrollableInput = 'medium';

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
 * The scopes live inside a `dbx-content-pit` that starts collapsed to a single
 * underlined summary line ("N permissions are being requested. Click here to
 * edit requested permissions."). Clicking it expands the pit to reveal the
 * selection list so the user can customize which scopes they grant. Starting
 * collapsed keeps the consent screen short enough that Approve/Deny are visible
 * without scrolling even when a client requests many scopes, and the expanded
 * pit is height-capped and scrollable for the same reason.
 *
 * The form itself is always mounted (hidden rather than removed while
 * collapsed) so `dbxActionForm` keeps supplying the granted-scope value to the
 * consent action even when the user never expands the pit.
 *
 * Required scopes are listed first and render as selected-and-disabled rows carrying an "Always
 * granted" note, so their description is visible alongside every other scope while staying
 * non-deselectable. The server force-grants them regardless of the submitted payload.
 *
 * Apps can override this default via
 * `DbxFirebaseOidcConfig.consentScopeListViewClass` or
 * `DbxOAuthConsentComponentConfig.consentScopeListViewClass`. Custom views
 * should similarly apply `dbxActionForm` to a forge form whose value matches
 * `OAuthConsentScopesFormValue`.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-default-view',
  styleUrls: ['./oauth.consent.scope.default.view.component.scss'],
  template: `
    <dbx-content-pit class="dbx-firebase-oauth-consent-scopes-pit" [scrollable]="pitScrollableSignal()">
      <div class="dbx-content-pit-scrollable-content">
        @if (!customizingSignal()) {
          <p class="dbx-firebase-oauth-consent-scopes-summary">
            <dbx-link [anchor]="customizeAnchor">{{ requestedScopesSummarySignal() }} Click here to edit requested permissions.</dbx-link>
          </p>
        }
        <!-- Hidden rather than removed while collapsed so dbxActionForm keeps supplying the granted scopes even when the pit is never expanded. -->
        <div [hidden]="!customizingSignal()">
          <dbx-firebase-oauth-consent-scope-form dbxActionForm [config]="formFieldsConfigSignal()"></dbx-firebase-oauth-consent-scope-form>
        </div>
      </div>
    </dbx-content-pit>
  `,
  imports: [DbxFirebaseOAuthConsentScopeFormComponent, DbxActionFormDirective, DbxContentPitDirective, DbxLinkComponent]
})
export class DbxFirebaseOAuthConsentScopeDefaultViewComponent {
  private readonly _oidcConfigService = inject(DbxFirebaseOidcConfigService);
  private readonly _data = inject<DbxFirebaseOAuthConsentScopesViewData>(DBX_INJECTION_COMPONENT_DATA);

  private readonly _customizing = signal<boolean>(false);

  /**
   * Every requested scope paired with its human-readable description, required ones first so the
   * always-granted rows head the list.
   */
  readonly mappedScopesSignal = computed<OAuthConsentScope[]>(() => {
    const availableScopes = this._oidcConfigService.availableScopes;
    const availableScopeValues = new Set(availableScopes.map((s) => s.value));
    const requiredSet = new Set<OidcScope>(this._data.requiredScopes ?? []);
    const { included: knownScopes, excluded: unknownScopes } = separateValues(this._data.scopes, (name) => availableScopeValues.has(name));

    const mappedScopes: OAuthConsentScope[] = [
      ...knownScopes.map((name) => {
        const details = availableScopes.find((s) => s.value === name);
        return { name, description: details?.description ?? '', required: requiredSet.has(name) };
      }),
      ...unknownScopes.map((name) => ({ name, description: 'unknown', required: requiredSet.has(name) }))
    ];

    const { included: requiredScopes, excluded: optionalScopes } = separateValues(mappedScopes, (scope) => scope.required === true);
    return [...requiredScopes, ...optionalScopes];
  });

  readonly formFieldsConfigSignal = computed<OAuthConsentScopesFormFieldsConfig>(() => ({
    scopes: this.mappedScopesSignal()
  }));

  /**
   * Leading sentence of the collapsed summary — the number of scopes the client is requesting,
   * counting the always-granted ones since the expanded pit accounts for them too.
   */
  readonly requestedScopesSummarySignal = computed<string>(() => {
    const count = this.mappedScopesSignal().length;
    return count === 1 ? '1 permission is being requested.' : `${count} permissions are being requested.`;
  });

  /**
   * True once the user has expanded the pit to review/customize the requested scopes.
   */
  readonly customizingSignal = this._customizing.asReadonly();

  readonly pitScrollableSignal = computed<Maybe<DbxContentPitScrollableInput>>(() => (this.customizingSignal() ? OAUTH_CONSENT_SCOPES_PIT_SCROLLABLE_HEIGHT : undefined));

  readonly customizeAnchor: ClickableAnchor = {
    onClick: () => this.showScopeCustomization()
  };

  showScopeCustomization(): void {
    this._customizing.set(true);
  }
}
