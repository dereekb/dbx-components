import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxButtonComponent, DbxActionSnackbarErrorDirective } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientFormComponent, type DbxFirebaseOidcEntryClientFormComponentConfig, type DbxFirebaseOidcModelClientUpdateFormValue } from '../component/oidcentry.client.form.component';
import { OidcEntryDocumentStore } from '../store/oidcentry.document.store';
import { type UpdateOidcClientParams, type OidcEntryOAuthClientPayloadData } from '@dereekb/firebase';
import { type Configurable } from '@dereekb/util';
import { map } from 'rxjs';

/**
 * Container component for updating an existing OAuth client.
 *
 * Wraps the client update form in an action context with a save button.
 */
@Component({
  selector: 'dbx-oidc-entry-client-update',
  template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleUpdateClient" dbxActionSnackbarError>
      <dbx-oidc-client-form dbxActionForm [dbxFormSource]="formTemplate$" [config]="formConfig"></dbx-oidc-client-form>
      <dbx-button [raised]="true" dbxActionButton text="Save"></dbx-button>
    </div>
  `,
  standalone: true,
  imports: [DbxActionSnackbarErrorDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxFormSourceDirective, DbxButtonComponent, DbxActionButtonDirective, DbxFirebaseOidcEntryClientFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryClientUpdateComponent {
  readonly oidcEntryDocumentStore = inject(OidcEntryDocumentStore);

  readonly formConfig: DbxFirebaseOidcEntryClientFormComponentConfig = { mode: 'update' };

  readonly formTemplate$ = this.oidcEntryDocumentStore.data$.pipe(
    map((data) => {
      const payload = data.payload as OidcEntryOAuthClientPayloadData;
      const formValue: DbxFirebaseOidcModelClientUpdateFormValue = {
        client_name: payload.client_name ?? '',
        redirect_uris: payload.redirect_uris ?? [],
        logo_uri: payload.logo_uri,
        client_uri: payload.client_uri
      };
      return formValue;
    })
  );

  readonly handleUpdateClient: WorkUsingContext<DbxFirebaseOidcModelClientUpdateFormValue> = (value, context) => {
    const params: Configurable<Omit<UpdateOidcClientParams, 'key'>> = value;
    context.startWorkingWithLoadingStateObservable(this.oidcEntryDocumentStore.updateClient(params));
  };
}
