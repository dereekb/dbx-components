import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxFormlyFormComponentProviders, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, AbstractConfigAsyncFormlyFormDirective } from '@dereekb/dbx-form';
import { oidcEntryClientFormFields, type OidcEntryClientFormFieldsConfig } from './oidcentry.form';
import { type CreateOidcClientParams, type UpdateOidcClientFieldParams } from '@dereekb/firebase';
import { map } from 'rxjs';

export interface DbxFirebaseOidcModelClientFormValue extends CreateOidcClientParams {}

export interface DbxFirebaseOidcModelClientUpdateFormValue extends UpdateOidcClientFieldParams {}

export type DbxFirebaseOidcEntryClientFormComponentConfig = OidcEntryClientFormFieldsConfig;

/**
 * Configurable form component for creating or updating an OAuth client.
 *
 * Pass `{ mode: 'create' }` to show all fields including `token_endpoint_auth_method`.
 * Pass `{ mode: 'update' }` to exclude `token_endpoint_auth_method` (immutable after creation).
 */
@Component({
  selector: 'dbx-oidc-client-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  providers: dbxFormlyFormComponentProviders(),
  imports: [DbxFormlyFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOidcEntryClientFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFirebaseOidcModelClientFormValue, DbxFirebaseOidcEntryClientFormComponentConfig> {
  readonly fields$ = this.config$.pipe(map((config) => oidcEntryClientFormFields(config)));
}
