import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, provideDbxForgeFormContext, DbxForgeFormComponent } from '@dereekb/dbx-form';
import { oidcEntryClientForgeFormFields, type OidcEntryClientFormFieldsConfig } from './oidcentry.forge.form';
import { type CreateOidcClientParams, type UpdateOidcClientFieldParams } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { map, type Observable } from 'rxjs';
import { DbxFirebaseOidcConfigService } from '../../../service/oidc.configuration.service';

export type DbxFirebaseOidcModelClientFormValue = CreateOidcClientParams;

export type DbxFirebaseOidcModelClientUpdateFormValue = UpdateOidcClientFieldParams;

/**
 * Config input for {@link DbxFirebaseOidcEntryClientForgeFormComponent}.
 *
 * Omits `tokenEndpointAuthMethods` since the component pulls those from {@link DbxFirebaseOidcConfigService}.
 */
export type DbxFirebaseOidcEntryClientFormComponentConfig = Omit<OidcEntryClientFormFieldsConfig, 'tokenEndpointAuthMethods'>;

/**
 * Configurable forge form component for creating or updating an OAuth client.
 *
 * Pass `{ mode: 'create' }` to show all fields including `token_endpoint_auth_method`.
 * Pass `{ mode: 'update' }` to exclude `token_endpoint_auth_method` (immutable after creation).
 *
 * Token endpoint auth methods are pulled from the injected {@link DbxFirebaseOidcConfigService}.
 */
@Component({
  selector: 'dbx-firebase-oidc-client-forge-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: provideDbxForgeFormContext(),
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOidcEntryClientForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseOidcModelClientFormValue, DbxFirebaseOidcEntryClientFormComponentConfig> {
  private readonly _oidcConfigService = inject(DbxFirebaseOidcConfigService);

  readonly config$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }

      return oidcEntryClientForgeFormFields({
        ...config,
        tokenEndpointAuthMethods: this._oidcConfigService.tokenEndpointAuthMethods
      });
    })
  );
}
