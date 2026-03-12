import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { DbxButtonComponent, DbxActionSnackbarErrorDirective } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientFormComponent, type DbxFirebaseOidcEntryClientFormComponentConfig, type DbxFirebaseOidcModelClientFormValue } from '../component/oidcentry.client.form.component';
import { OidcEntryDocumentStore } from '../store/oidcentry.document.store';
import { type CreateOidcClientParams, type CreateOidcClientResult, type FirestoreModelKey } from '@dereekb/firebase';
import { type Configurable, type Maybe } from '@dereekb/util';
import { tap } from 'rxjs';

/**
 * Container component for creating a new OAuth client.
 *
 * Wraps the client form in an action context with a submit button.
 * Emits {@link clientCreated} with the result after successful creation.
 */
@Component({
  selector: 'dbx-oidc-entry-client-create',
  template: `
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleCreateClient" dbxActionSnackbarError>
      <dbx-oidc-client-form dbxActionForm [config]="formConfig"></dbx-oidc-client-form>
      <dbx-button [raised]="true" dbxActionButton text="Create"></dbx-button>
    </div>
  `,
  standalone: true,
  imports: [DbxActionSnackbarErrorDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective, DbxFirebaseOidcEntryClientFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseOidcEntryClientCreateComponent {
  readonly oidcEntryDocumentStore = inject(OidcEntryDocumentStore);

  readonly formConfig: DbxFirebaseOidcEntryClientFormComponentConfig = { mode: 'create' };

  readonly createClientOwnerTarget = input<Maybe<FirestoreModelKey>>();
  readonly clientCreated = output<CreateOidcClientResult>();

  readonly handleCreateClient: WorkUsingContext<DbxFirebaseOidcModelClientFormValue> = (value, context) => {
    const params: Configurable<CreateOidcClientParams> = value;
    const target = this.createClientOwnerTarget();

    if (target) {
      params.key = target;
    }

    context.startWorkingWithLoadingStateObservable(
      this.oidcEntryDocumentStore.createClient(params).pipe(
        tap((state) => {
          if (state.value) {
            this.clientCreated.emit(state.value);
          }
        })
      )
    );
  };
}
