import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDialogDirective, DbxActionModule, DbxButtonModule, DbxDialogModule, DbxErrorComponent } from '@dereekb/dbx-web';
import { type MatDialog } from '@angular/material/dialog';
import { type WorkUsingContext, switchMapWhileTrue, type IsEqualFunction } from '@dereekb/rxjs';
import { DemoGuestbookEntryFormComponent, type DemoGuestbookEntryFormValue, type GuestbookEntryDocumentStore } from 'demo-components';
import { map } from 'rxjs';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { toSignal } from '@angular/core/rxjs-interop';

export interface DemoGuestbookEntryPopupComponentConfig {
  guestbookEntryDocumentStore: GuestbookEntryDocumentStore;
}

@Component({
  template: `
    <dbx-dialog-content>
      <p class="dbx-note">Enter your message for the guest book.</p>
      <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleUpdateEntry">
        <demo-guestbook-entry-form dbxActionForm [dbxFormSource]="data$" [dbxActionFormIsEqual]="isFormSame"></demo-guestbook-entry-form>
        <p></p>
        <dbx-button [raised]="true" [text]="existsSignal() ? 'Save Changes' : 'Create Guestbook Entry'" dbxActionButton></dbx-button>
        <dbx-error dbxActionError></dbx-error>
      </div>
    </dbx-dialog-content>
  `,
  imports: [DbxActionFormDirective, DbxDialogModule, DbxActionModule, DbxFormSourceDirective, DbxButtonModule, DemoGuestbookEntryFormComponent, DbxErrorComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoGuestbookEntryPopupComponent extends AbstractDialogDirective<unknown, DemoGuestbookEntryPopupComponentConfig> {
  get guestbookEntryDocumentStore(): GuestbookEntryDocumentStore {
    return this.data.guestbookEntryDocumentStore;
  }

  get data$() {
    return this.guestbookEntryDocumentStore.data$;
  }

  get exists$() {
    return this.guestbookEntryDocumentStore.exists$;
  }

  readonly existsSignal = toSignal(this.exists$);

  static openPopup(matDialog: MatDialog, config: DemoGuestbookEntryPopupComponentConfig) {
    return matDialog.open(DemoGuestbookEntryPopupComponent, {
      data: config
    });
  }

  readonly isFormSame: IsEqualFunction<DemoGuestbookEntryFormValue> = (value) => {
    return this.exists$.pipe(
      switchMapWhileTrue<boolean>(
        this.data$.pipe(
          map((current) => {
            return current.message === value.message && current.signed === value.signed && current.published === value.published;
          })
        ),
        false
      )
    );
  };

  readonly handleUpdateEntry: WorkUsingContext<DemoGuestbookEntryFormValue, void> = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.guestbookEntryDocumentStore.insertEntry(value));
  };
}
