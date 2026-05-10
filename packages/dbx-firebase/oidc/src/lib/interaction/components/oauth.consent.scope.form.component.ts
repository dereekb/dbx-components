import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { map, type Observable } from 'rxjs';
import { type OAuthConsentScopesFormFieldsConfig, type OAuthConsentScopesFormValue, oauthConsentScopesFormConfig } from './oauth.consent.scope.forms';

/**
 * Reusable forge form component that renders one checkbox per OIDC scope
 * defined in {@link OAuthConsentScopesFormFieldsConfig}. Required scopes are
 * rendered as checked-and-disabled.
 *
 * Pair with `<dbx-firebase-oauth-consent-scope-default-view>` for the default
 * consent flow, or embed directly in custom consent UIs that supply their
 * own scope/required configuration.
 */
@Component({
  selector: 'dbx-firebase-oauth-consent-scope-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOAuthConsentScopeFormComponent extends AbstractConfigAsyncForgeFormDirective<OAuthConsentScopesFormValue, OAuthConsentScopesFormFieldsConfig> {
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(map((config) => (config ? oauthConsentScopesFormConfig(config) : undefined)));
}
