import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, provideDbxForgeFormContext, DbxForgeFormComponent } from '@dereekb/dbx-form';
import { oidcEntryClientTestForgeFormFields, type OidcEntryClientTestFormFieldsConfig } from './oidcentry.forge.form';
import { type Maybe } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { map, type Observable } from 'rxjs';

export interface DbxFirebaseOidcModelClientTestFormValue {
  client_id: string;
  redirect_uri: string;
  scopes: string[];
}

export type DbxFirebaseOidcEntryClientTestFormComponentConfig = OidcEntryClientTestFormFieldsConfig;

/**
 * Forge form component for configuring an OAuth test authorization request.
 *
 * Displays read-only client_id, a redirect URI selector, and scope picker.
 */
@Component({
  selector: 'dbx-firebase-oidc-client-test-forge-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: provideDbxForgeFormContext(),
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseOidcEntryClientTestForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseOidcModelClientTestFormValue, DbxFirebaseOidcEntryClientTestFormComponentConfig> {
  readonly config$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }

      return oidcEntryClientTestForgeFormFields(config);
    })
  );
}
