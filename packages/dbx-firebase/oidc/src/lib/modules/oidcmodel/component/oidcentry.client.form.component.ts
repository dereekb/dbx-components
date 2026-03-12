import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxFormlyFormComponentProviders, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, AbstractSyncFormlyFormDirective } from '@dereekb/dbx-form';
import { oidcEntryClientFormFields } from './oidcentry.form';
import { type AbstractOidcClientParams } from '@dereekb/firebase';

export interface DbxFirebaseOidcModelClientFormValue extends AbstractOidcClientParams {}

/**
 * Form component for creating or updating an OAuth client.
 *
 * Shows all fields from {@link AbstractOidcClientParams} with client_name required.
 */
@Component({
  selector: 'dbx-oidc-client-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  providers: dbxFormlyFormComponentProviders(),
  imports: [DbxFormlyFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOidcEntryClientFormComponent extends AbstractSyncFormlyFormDirective<DbxFirebaseOidcModelClientFormValue> {
  readonly fields = oidcEntryClientFormFields();
}
