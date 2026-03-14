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
 */
export function oidcEntryClientFormFields(config?: OidcEntryClientFormFieldsConfig): FormlyFieldConfig[] {
  const fields = [];

  if (config?.mode === 'create') {
    fields.push(oidcClientTokenEndpointAuthMethodField(config));
  }

  fields.push(...oidcEntryClientUpdateFormFields());

  return fields;
}

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
 */
export function oidcEntryClientUpdateFormFields(): FormlyFieldConfig[] {
  return [oidcClientNameField(), oidcClientRedirectUrisField(), oidcClientJwksUriField(), oidcClientLogoUriField(), oidcClientHomepageUriField()];
}

export function oidcClientNameField(): FormlyFieldConfig {
  return textField({
    key: 'client_name',
    label: 'Client Name',
    description: 'A human-readable name for this OAuth client.',
    required: true,
    maxLength: 200
  });
}

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

export function oidcClientLogoUriField(): FormlyFieldConfig {
  return textField({
    key: 'logo_uri',
    label: 'Logo URI',
    description: 'URL of the client logo image (optional).',
    required: false
  });
}

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
 */
export function oidcEntryClientTestFormFields(config: OidcEntryClientTestFormFieldsConfig): FormlyFieldConfig[] {
  return [oidcClientTestClientIdField(), oidcClientTestRedirectUriField(config.redirectUris), oidcClientTestScopesField(config.availableScopes)];
}

export function oidcClientTestClientIdField(): FormlyFieldConfig {
  return textField({
    key: 'client_id',
    label: 'Client ID',
    readonly: true
  });
}

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

export function oidcClientTestScopesField(availableScopes: OidcScopeDetails[]): FormlyFieldConfig {
  return pickableItemChipField({
    key: 'scopes',
    label: 'Scopes',
    description: 'Select the scopes to request.',
    showSelectAllButton: true,
    ...pickableValueFieldValuesConfigForStaticLabeledValues(availableScopes)
  });
}
