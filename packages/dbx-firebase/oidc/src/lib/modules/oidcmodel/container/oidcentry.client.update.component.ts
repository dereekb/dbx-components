import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { DbxButtonComponent, DbxActionSnackbarErrorDirective } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientFormComponent, type DbxFirebaseOidcModelClientFormValue } from '../component/oidcentry.client.form.component';
import { OidcEntryDocumentStore } from '../store/oidcentry.document.store';
import { type UpdateOidcClientParams } from '@dereekb/firebase';
import { type Configurable } from '@dereekb/util';

/**
 * Container component for updating an existing OAuth client.
 *
 * Wraps the client form in an action context with a save button.
 */
@Component({
  selector: 'dbx-oidc-entry-client-update',
  template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleUpdateClient" dbxActionSnackbarError>
      <dbx-oidc-client-form dbxActionForm></dbx-oidc-client-form>
      <dbx-button [raised]="true" dbxActionButton text="Save"></dbx-button>
    </div>
  `,
  standalone: true,
  imports: [DbxActionSnackbarErrorDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective, DbxFirebaseOidcEntryClientFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryClientUpdateComponent {
  readonly oidcEntryDocumentStore = inject(OidcEntryDocumentStore);

  readonly handleUpdateClient: WorkUsingContext<DbxFirebaseOidcModelClientFormValue> = (value, context) => {
    const params: Configurable<Omit<UpdateOidcClientParams, 'key'>> = value;
    context.startWorkingWithLoadingStateObservable(this.oidcEntryDocumentStore.updateClient(params));
  };
}
