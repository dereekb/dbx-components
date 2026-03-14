import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxFormlyFormComponentProviders, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, AbstractConfigAsyncFormlyFormDirective } from '@dereekb/dbx-form';
import { oidcEntryClientTestFormFields, type OidcEntryClientTestFormFieldsConfig } from './oidcentry.form';
import { map } from 'rxjs';

export interface DbxFirebaseOidcModelClientTestFormValue {
  client_id: string;
  redirect_uri: string;
  scopes: string[];
}

export type DbxFirebaseOidcEntryClientTestFormComponentConfig = OidcEntryClientTestFormFieldsConfig;

/**
 * Form component for configuring an OAuth test authorization request.
 *
 * Displays read-only client_id/secret, a redirect URI selector, and scope picker.
 */
@Component({
  selector: 'dbx-firebase-oidc-client-test-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  providers: dbxFormlyFormComponentProviders(),
  imports: [DbxFormlyFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOidcEntryClientTestFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFirebaseOidcModelClientTestFormValue, DbxFirebaseOidcEntryClientTestFormComponentConfig> {
  readonly fields$ = this.config$.pipe(map((config) => oidcEntryClientTestFormFields(config)));
}
