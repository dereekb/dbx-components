import { textField, valueSelectionField, isWebsiteUrlValidator, searchableStringChipField, pickableItemChipField, pickableValueFieldValuesConfigForStaticLabeledValues } from '@dereekb/dbx-form';
import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS, PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD, type OidcRedirectUri, type OidcScopeDetails, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { type FormlyFieldConfig } from '@ngx-formly/core';
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
 * Creates fields for the OAuth client create form.
 *
 * Includes `token_endpoint_auth_method` which is immutable after creation.
 *
 * @param config - Optional configuration for field generation, including mode and allowed auth methods.
 * @returns Array of FormlyFieldConfig for the client creation form.
 */
export function oidcEntryClientFormFields(config?: OidcEntryClientFormFieldsConfig): FormlyFieldConfig[] {
  const fields = [];

  if (config?.mode === 'create') {
    fields.push(oidcClientTokenEndpointAuthMethodField(config));
  }

  fields.push(...oidcEntryClientUpdateFormFields());

  return fields;
}

/**
 * Creates a value selection field for choosing the token endpoint authentication method.
 *
 * @param config - Optional configuration to filter the available auth method options.
 * @returns A FormlyFieldConfig for the token endpoint auth method selector.
 */
export function oidcClientTokenEndpointAuthMethodField(config?: OidcEntryClientFormFieldsConfig): FormlyFieldConfig {
  const allowedAuthMethods = config?.tokenEndpointAuthMethods;
  const options = allowedAuthMethods?.length ? ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.filter((o) => allowedAuthMethods.includes(o.value)) : ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS;

  return valueSelectionField({
    key: 'token_endpoint_auth_method',
    label: 'Token Endpoint Auth Method',
    description: 'How the client authenticates when exchanging tokens. Cannot be changed after creation.',
    required: true,
    options
  });
}

/**
 * Creates fields for updating an existing OAuth client.
 *
 * Excludes `token_endpoint_auth_method` (immutable after creation).
 *
 * @returns Array of FormlyFieldConfig for the client update form.
 */
export function oidcEntryClientUpdateFormFields(): FormlyFieldConfig[] {
  return [oidcClientNameField(), oidcClientRedirectUrisField(), oidcClientJwksUriField(), oidcClientLogoUriField(), oidcClientHomepageUriField()];
}

/**
 * Creates a text field for the OAuth client display name.
 *
 * @returns A FormlyFieldConfig for the client name input.
 */
export function oidcClientNameField(): FormlyFieldConfig {
  return textField({
    key: 'client_name',
    label: 'Client Name',
    description: 'A human-readable name for this OAuth client.',
    required: true,
    maxLength: 200
  });
}

/**
 * Creates a searchable chip field for entering redirect URIs.
 *
 * @returns A FormlyFieldConfig for the redirect URIs input.
 */
export function oidcClientRedirectUrisField(): FormlyFieldConfig {
  return searchableStringChipField({
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
 * Creates a text field for the client's JWKS URI. Only visible when using private_key_jwt authentication.
 *
 * @returns A FormlyFieldConfig for the JWKS URI input.
 */
export function oidcClientJwksUriField(): FormlyFieldConfig {
  return textField({
    key: 'jwks_uri',
    label: 'JWKS URI',
    description: "URL where the client's public JSON Web Key Set can be fetched. Required for private_key_jwt authentication.",
    required: true,
    expressions: {
      hide: (field) => field.model?.token_endpoint_auth_method !== PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD
    }
  });
}

/**
 * Creates a text field for the optional client logo URL.
 *
 * @returns A FormlyFieldConfig for the logo URI input.
 */
export function oidcClientLogoUriField(): FormlyFieldConfig {
  return textField({
    key: 'logo_uri',
    label: 'Logo URI',
    description: 'URL of the client logo image (optional).',
    required: false
  });
}

/**
 * Creates a text field for the optional client homepage URL.
 *
 * @returns A FormlyFieldConfig for the homepage URL input.
 */
export function oidcClientHomepageUriField(): FormlyFieldConfig {
  return textField({
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
 * Assembles the form fields for the OAuth test client form.
 *
 * @param config - Configuration providing available redirect URIs and scopes for the test form.
 * @returns Array of FormlyFieldConfig for the test client form.
 */
export function oidcEntryClientTestFormFields(config: OidcEntryClientTestFormFieldsConfig): FormlyFieldConfig[] {
  return [oidcClientTestClientIdField(), oidcClientTestRedirectUriField(config.redirectUris), oidcClientTestScopesField(config.availableScopes)];
}

/**
 * Creates a read-only text field displaying the OAuth client ID.
 *
 * @returns A FormlyFieldConfig for the client ID display.
 */
export function oidcClientTestClientIdField(): FormlyFieldConfig {
  return textField({
    key: 'client_id',
    label: 'Client ID',
    readonly: true
  });
}

/**
 * Creates a selection field for choosing one of the client's registered redirect URIs for testing.
 *
 * @param redirectUris - The registered redirect URIs to display as options.
 * @returns A FormlyFieldConfig for the redirect URI selector.
 */
export function oidcClientTestRedirectUriField(redirectUris: OidcRedirectUri[]): FormlyFieldConfig {
  const options = redirectUris.map((uri) => ({ label: uri, value: uri }));

  return valueSelectionField({
    key: 'redirect_uri',
    label: 'Redirect URI',
    description: 'Select the redirect URI to use for the test flow.',
    required: true,
    options
  });
}

/**
 * Creates a pickable chip field for selecting scopes to request during the test flow.
 *
 * @param availableScopes - The available scopes to display as selectable options.
 * @returns A FormlyFieldConfig for the scopes selector.
 */
export function oidcClientTestScopesField(availableScopes: OidcScopeDetails[]): FormlyFieldConfig {
  return pickableItemChipField({
    key: 'scopes',
    label: 'Scopes',
    description: 'Select the scopes to request.',
    showSelectAllButton: true,
    ...pickableValueFieldValuesConfigForStaticLabeledValues(availableScopes)
  });
}
