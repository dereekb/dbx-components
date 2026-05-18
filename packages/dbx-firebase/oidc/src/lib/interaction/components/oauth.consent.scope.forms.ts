import { dbxForgeListSelectionField } from '@dereekb/dbx-form';
import { type FormConfig, type ValidatorConfig } from '@ng-forge/dynamic-forms';
import { type OidcScope } from '@dereekb/firebase';
import { successResult } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { type OAuthConsentScope } from './oauth.consent.scope';
import { DbxFirebaseOAuthConsentScopeListComponent } from './oauth.consent.scope.list.component';

/**
 * Validator key emitted when the user has not selected any optional scope.
 * Surfaces alongside the form's invalid state so the action button stays disabled.
 */
export const OAUTH_CONSENT_SCOPES_REQUIRED_VALIDATOR_KIND = 'mustSelectAtLeastOneScope';

/**
 * Default message shown when the user has cleared every optional scope.
 */
export const DEFAULT_OAUTH_CONSENT_SCOPES_REQUIRED_VALIDATOR_MESSAGE = 'Select at least one scope to grant.';

/**
 * Form value emitted by the consent scopes form.
 *
 * Uses the same key as the `OAuthInteractionConsentRequest.grantedOIDCScopes`
 * payload field so the consent action handler can pass the form value through
 * directly.
 */
export interface OAuthConsentScopesFormValue {
  readonly grantedOIDCScopes: OidcScope[];
}

/**
 * Configuration for the consent scopes form.
 *
 * Required scopes are filtered out by the caller before being passed in —
 * required scopes are surfaced separately as a static "Always granted" line
 * because they are not user-selectable.
 */
export interface OAuthConsentScopesFormFieldsConfig {
  /**
   * Optional scopes the user can choose to grant.
   */
  readonly optionalScopes: readonly OAuthConsentScope[];
  /**
   * Initial selection set. Defaults to every optional scope being selected.
   */
  readonly initiallySelected?: readonly OidcScope[];
}

/**
 * Builds a complete `FormConfig` ready to feed into a forge form component.
 *
 * The resulting form has a single `grantedOIDCScopes` field — a
 * `dbxForgeListSelectionField` rendered through
 * `DbxFirebaseOAuthConsentScopeListComponent` (a `dbx-list` selection wrapper).
 * The list renders bare (no Material form-field wrapper) and without the
 * default 300px height cap so it grows to fit the scope list.
 *
 * @param config - The consent scopes form fields configuration.
 * @returns A `FormConfig` whose single field selects an `OidcScope[]` of granted scopes.
 */
export function oauthConsentScopesFormConfig(config: OAuthConsentScopesFormFieldsConfig): FormConfig {
  const { optionalScopes, initiallySelected } = config;
  const value: OidcScope[] = (initiallySelected ?? optionalScopes.map((scope) => scope.name)).slice();
  const optionalScopesArray = optionalScopes.slice();
  const validators: ValidatorConfig[] = [
    {
      type: 'custom',
      expression: 'fieldValue && fieldValue.length > 0',
      kind: OAUTH_CONSENT_SCOPES_REQUIRED_VALIDATOR_KIND
    }
  ];

  return {
    fields: [
      dbxForgeListSelectionField<OAuthConsentScope, DbxFirebaseOAuthConsentScopeListComponent, OidcScope>({
        key: 'grantedOIDCScopes',
        value,
        validators,
        validationMessages: {
          [OAUTH_CONSENT_SCOPES_REQUIRED_VALIDATOR_KIND]: DEFAULT_OAUTH_CONSENT_SCOPES_REQUIRED_VALIDATOR_MESSAGE
        },
        props: {
          listComponentClass: of(DbxFirebaseOAuthConsentScopeListComponent),
          readKey: (scope) => scope.name,
          state$: of(successResult(optionalScopesArray)),
          wrapped: false,
          maxHeight: 'none'
        }
      })
    ]
  };
}
