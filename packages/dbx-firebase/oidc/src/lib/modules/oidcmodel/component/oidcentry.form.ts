import { textField, searchableStringChipField } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { of } from 'rxjs';

// MARK: OidcClient Form Fields

/**
 * Creates fields for the OAuth client form.
 *
 * client_name is required.
 */
export function oidcEntryClientFormFields(): FormlyFieldConfig[] {
  return [oidcClientNameField({ required: true }), oidcClientRedirectUrisField(), oidcClientGrantTypesField(), oidcClientResponseTypesField()];
}

export function oidcClientNameField(config?: { required?: boolean }): FormlyFieldConfig {
  return textField({
    key: 'client_name',
    label: 'Client Name',
    description: 'A human-readable name for this OAuth client.',
    required: config?.required ?? false,
    maxLength: 200
  });
}

export function oidcClientRedirectUrisField(config?: { required?: boolean }): FormlyFieldConfig {
  return searchableStringChipField({
    key: 'redirect_uris',
    label: 'Redirect URIs',
    description: 'Type a redirect URI and press enter to add it.',
    required: config?.required ?? false,
    searchOnEmptyText: false,
    search: () => of([]),
    displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
  });
}

export function oidcClientGrantTypesField(): FormlyFieldConfig {
  return searchableStringChipField({
    key: 'grant_types',
    label: 'Grant Types',
    description: 'Type a grant type (e.g. authorization_code, refresh_token) and press enter to add it.',
    searchOnEmptyText: false,
    search: () => of([]),
    displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
  });
}

export function oidcClientResponseTypesField(): FormlyFieldConfig {
  return searchableStringChipField({
    key: 'response_types',
    label: 'Response Types',
    description: 'Type a response type (e.g. code) and press enter to add it.',
    searchOnEmptyText: false,
    search: () => of([]),
    displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
  });
}
