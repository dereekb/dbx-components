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
 * Required scopes are included in the list rather than filtered out — they render as
 * selected-and-disabled rows so their description stays visible while remaining
 * non-deselectable. They are always part of the submitted value; the server force-grants them
 * regardless.
 */
export interface OAuthConsentScopesFormFieldsConfig {
  /**
   * Scopes to render. Entries flagged `required` are selected and locked on.
   */
  readonly scopes: readonly OAuthConsentScope[];
  /**
   * Initial selection set. Defaults to every scope being selected. Required scopes are always
   * selected regardless of what is passed here.
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
 * Required scopes are seeded into the initial value and rendered as disabled rows, so they cannot
 * be deselected. Because they are always present in the value, the "select at least one" validator
 * compares against the required count rather than zero — and is skipped entirely when every
 * requested scope is required (there would be nothing left to select).
 *
 * @param config - The consent scopes form fields configuration.
 * @returns A `FormConfig` whose single field selects an `OidcScope[]` of granted scopes.
 */
export function oauthConsentScopesFormConfig(config: OAuthConsentScopesFormFieldsConfig): FormConfig {
  const { scopes, initiallySelected } = config;
  const scopesArray = scopes.slice();
  const requiredScopeNames = scopesArray.filter((scope) => scope.required).map((scope) => scope.name);
  const selectedScopeNames = initiallySelected ?? scopesArray.map((scope) => scope.name);
  const value: OidcScope[] = Array.from(new Set<OidcScope>([...requiredScopeNames, ...selectedScopeNames]));
  const hasOptionalScopes = requiredScopeNames.length < scopesArray.length;
  const validators: ValidatorConfig[] = hasOptionalScopes
    ? [
        {
          type: 'custom',
          expression: `fieldValue && fieldValue.length > ${requiredScopeNames.length}`,
          kind: OAUTH_CONSENT_SCOPES_REQUIRED_VALIDATOR_KIND
        }
      ]
    : [];

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
          state$: of(successResult(scopesArray)),
          wrapped: false,
          maxHeight: 'none'
        }
      })
    ]
  };
}
