import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { dbxFormlyFormComponentProviders, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, AbstractConfigAsyncFormlyFormDirective } from '@dereekb/dbx-form';
import { oidcEntryClientFormFields, type OidcEntryClientFormFieldsConfig } from './oidcentry.form';
import { type CreateOidcClientParams, type UpdateOidcClientFieldParams } from '@dereekb/firebase';
import { map } from 'rxjs';
import { DbxFirebaseOidcConfigService } from '../../../service/oidc.configuration.service';

export interface DbxFirebaseOidcModelClientFormValue extends CreateOidcClientParams {}

export interface DbxFirebaseOidcModelClientUpdateFormValue extends UpdateOidcClientFieldParams {}

/**
 * Config input for {@link DbxFirebaseOidcEntryClientFormComponent}.
 *
 * Omits `tokenEndpointAuthMethods` since the component pulls those from {@link DbxFirebaseOidcConfigService}.
 */
export type DbxFirebaseOidcEntryClientFormComponentConfig = Omit<OidcEntryClientFormFieldsConfig, 'tokenEndpointAuthMethods'>;

/**
 * Configurable form component for creating or updating an OAuth client.
 *
 * Pass `{ mode: 'create' }` to show all fields including `token_endpoint_auth_method`.
 * Pass `{ mode: 'update' }` to exclude `token_endpoint_auth_method` (immutable after creation).
 *
 * Token endpoint auth methods are pulled from the injected {@link DbxFirebaseOidcConfigService}.
 */
@Component({
  selector: 'dbx-firebase-oidc-client-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  providers: dbxFormlyFormComponentProviders(),
  imports: [DbxFormlyFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOidcEntryClientFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFirebaseOidcModelClientFormValue, DbxFirebaseOidcEntryClientFormComponentConfig> {
  private readonly _oidcConfigService = inject(DbxFirebaseOidcConfigService);

  readonly fields$ = this.config$.pipe(
    map((config) =>
      oidcEntryClientFormFields({
        ...config,
        tokenEndpointAuthMethods: this._oidcConfigService.tokenEndpointAuthMethods
      })
    )
  );
}
