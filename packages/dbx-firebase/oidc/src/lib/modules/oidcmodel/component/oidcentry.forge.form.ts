import { forgeTextField, forgeValueSelectionField, forgeSearchableStringChipField, forgePickableChipField, forgeGroup, pickableValueFieldValuesConfigForStaticLabeledValues, isWebsiteUrlValidator } from '@dereekb/dbx-form';
import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS, PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD, type OidcRedirectUri, type OidcScopeDetails, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';

// MARK: OidcClient Form Fields

export interface OidcEntryClientFormFieldsConfig {
  /**
   * Mode to show. Defaults to 'create'.
   */
  readonly mode: 'create' | 'update';
  /**
   * Token endpoint auth methods available for selection.
   *
   * Provided by the {@link DbxFirebaseOidcConfigService}.
   */
  readonly tokenEndpointAuthMethods: OidcTokenEndpointAuthMethod[];
}

/**
 * Creates forge fields for the OAuth client create form.
 *
 * Includes `token_endpoint_auth_method` which is immutable after creation.
 *
 * @param config - Optional configuration for field generation, including mode and allowed auth methods.
 * @returns A FormConfig for the client creation form.
 */
export function oidcEntryClientForgeFormFields(config?: OidcEntryClientFormFieldsConfig): FormConfig {
  const fields = [];

  if (config?.mode === 'create') {
    fields.push(oidcClientTokenEndpointAuthMethodForgeField(config));
  }

  fields.push(...oidcEntryClientUpdateForgeFormFields());

  return { fields };
}

/**
 * Creates a forge value selection field for choosing the token endpoint authentication method.
 *
 * @param config - Optional configuration to filter the available auth method options.
 * @returns A forge value selection field for the token endpoint auth method selector.
 */
export function oidcClientTokenEndpointAuthMethodForgeField(config?: OidcEntryClientFormFieldsConfig) {
  const allowedAuthMethods = config?.tokenEndpointAuthMethods;
  const options = allowedAuthMethods?.length ? ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.filter((o) => allowedAuthMethods.includes(o.value)) : ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS;

  return forgeValueSelectionField({
    key: 'token_endpoint_auth_method',
    label: 'Token Endpoint Auth Method',
    description: 'How the client authenticates when exchanging tokens. Cannot be changed after creation.',
    required: true,
    options
  });
}

/**
 * Creates forge fields for updating an existing OAuth client.
 *
 * Excludes `token_endpoint_auth_method` (immutable after creation).
 *
 * @returns Array of forge field definitions for the client update form.
 */
export function oidcEntryClientUpdateForgeFormFields() {
  return [oidcClientNameForgeField(), oidcClientRedirectUrisForgeField(), oidcClientJwksUriForgeField(), oidcClientLogoUriForgeField(), oidcClientHomepageUriForgeField()];
}

/**
 * Creates a forge text field for the OAuth client display name.
 */
export function oidcClientNameForgeField() {
  return forgeTextField({
    key: 'client_name',
    label: 'Client Name',
    description: 'A human-readable name for this OAuth client.',
    required: true,
    maxLength: 200
  });
}

/**
 * Creates a forge searchable chip field for entering redirect URIs.
 */
export function oidcClientRedirectUrisForgeField() {
  return forgeSearchableStringChipField({
    key: 'redirect_uris',
    label: 'Redirect URIs',
    description: 'Type a redirect URI (e.g. https://example.com/callback) and press enter to add it.',
    required: true,
    searchOnEmptyText: false,
    textInputValidator: isWebsiteUrlValidator({ requirePrefix: true, allowPorts: true }),
    search: () => of([]),
    displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
  });
}

/**
 * Creates a forge group containing the JWKS URI field, conditionally hidden
 * when the token endpoint auth method is not `private_key_jwt`.
 */
export function oidcClientJwksUriForgeField() {
  return forgeGroup({
    fields: [
      forgeTextField({
        key: 'jwks_uri',
        label: 'JWKS URI',
        description: "URL where the client's public JSON Web Key Set can be fetched. Required for private_key_jwt authentication.",
        required: true
      })
    ],
    logic: [
      {
        type: 'hidden',
        condition: {
          type: 'fieldValue',
          fieldPath: 'token_endpoint_auth_method',
          operator: 'notEquals',
          value: PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD
        }
      }
    ]
  });
}

/**
 * Creates a forge text field for the optional client logo URL.
 */
export function oidcClientLogoUriForgeField() {
  return forgeTextField({
    key: 'logo_uri',
    label: 'Logo URI',
    description: 'URL of the client logo image (optional).',
    required: false
  });
}

/**
 * Creates a forge text field for the optional client homepage URL.
 */
export function oidcClientHomepageUriForgeField() {
  return forgeTextField({
    key: 'client_uri',
    label: 'Homepage URL',
    description: 'URL of the client homepage (optional).',
    required: false
  });
}

// MARK: OidcClient Test Form Fields

export interface OidcEntryClientTestFormFieldsConfig {
  readonly redirectUris: OidcRedirectUri[];
  readonly availableScopes: OidcScopeDetails[];
}

/**
 * Assembles the forge form fields for the OAuth test client form.
 *
 * @param config - Configuration providing available redirect URIs and scopes for the test form.
 * @returns A FormConfig for the test client form.
 */
export function oidcEntryClientTestForgeFormFields(config: OidcEntryClientTestFormFieldsConfig): FormConfig {
  return { fields: [oidcClientTestClientIdForgeField(), oidcClientTestRedirectUriForgeField(config.redirectUris), oidcClientTestScopesForgeField(config.availableScopes)] };
}

/**
 * Creates a read-only forge text field displaying the OAuth client ID.
 */
export function oidcClientTestClientIdForgeField() {
  return forgeTextField({
    key: 'client_id',
    label: 'Client ID',
    readonly: true
  });
}

/**
 * Creates a forge selection field for choosing one of the client's registered redirect URIs for testing.
 *
 * @param redirectUris - The registered redirect URIs to display as options.
 */
export function oidcClientTestRedirectUriForgeField(redirectUris: OidcRedirectUri[]) {
  const options = redirectUris.map((uri) => ({ label: uri, value: uri }));

  return forgeValueSelectionField({
    key: 'redirect_uri',
    label: 'Redirect URI',
    description: 'Select the redirect URI to use for the test flow.',
    required: true,
    options
  });
}

/**
 * Creates a forge pickable chip field for selecting scopes to request during the test flow.
 *
 * @param availableScopes - The available scopes to display as selectable options.
 */
export function oidcClientTestScopesForgeField(availableScopes: OidcScopeDetails[]) {
  return forgePickableChipField({
    key: 'scopes',
    label: 'Scopes',
    description: 'Select the scopes to request.',
    showSelectAllButton: true,
    ...pickableValueFieldValuesConfigForStaticLabeledValues(availableScopes)
  });
}
