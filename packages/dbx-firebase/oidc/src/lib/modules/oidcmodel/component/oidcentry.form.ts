import { textField, valueSelectionField, isWebsiteUrlValidator, searchableStringChipField, pickableItemChipField, pickableValueFieldValuesConfigForStaticLabeledValues } from '@dereekb/dbx-form';
import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS, type OidcRedirectUri, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { of } from 'rxjs';

// MARK: OidcClient Form Fields

export interface OidcEntryClientFormFieldsConfig {
  /**
   * Mode to show. Defaults to 'create'.
   */
  readonly mode: 'create' | 'update';
  /**
   * Limits which token endpoint auth methods are available for selection.
   *
   * If not provided, all methods are shown.
   */
  readonly allowedAuthMethods?: Maybe<OidcTokenEndpointAuthMethod[]>;
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
  const allowedAuthMethods = config?.allowedAuthMethods;
  const options = allowedAuthMethods ? ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.filter((o) => allowedAuthMethods.includes(o.value)) : ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS;

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
  return [oidcClientNameField(), oidcClientRedirectUrisField(), oidcClientLogoUriField(), oidcClientHomepageUriField()];
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
  readonly availableScopes: LabeledValue<string>[];
}

/**
 * Assembles the form fields for the OAuth test client form.
 */
export function oidcEntryClientTestFormFields(config: OidcEntryClientTestFormFieldsConfig): FormlyFieldConfig[] {
  return [oidcClientTestClientIdField(), oidcClientTestClientSecretField(), oidcClientTestRedirectUriField(config.redirectUris), oidcClientTestScopesField(config.availableScopes)];
}

export function oidcClientTestClientIdField(): FormlyFieldConfig {
  return textField({
    key: 'client_id',
    label: 'Client ID',
    readonly: true
  });
}

export function oidcClientTestClientSecretField(): FormlyFieldConfig {
  return textField({
    key: 'client_secret',
    label: 'Client Secret',
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

export function oidcClientTestScopesField(availableScopes: LabeledValue<string>[]): FormlyFieldConfig {
  return pickableItemChipField({
    key: 'scopes',
    label: 'Scopes',
    description: 'Select the scopes to request.',
    showSelectAllButton: true,
    ...pickableValueFieldValuesConfigForStaticLabeledValues(availableScopes)
  });
}
