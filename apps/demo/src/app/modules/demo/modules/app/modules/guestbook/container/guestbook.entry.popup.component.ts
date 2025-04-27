import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { WorkUsingContext, switchMapWhileTrue, IsEqualFunction } from '@dereekb/rxjs';
import { DemoGuestbookEntryFormValue, GuestbookEntryDocumentStore } from 'demo-components';
import { map } from 'rxjs';

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
        <dbx-button [raised]="true" [text]="(exists$ | async) ? 'Save Changes' : 'Create Guestbook Entry'" dbxActionButton></dbx-button>
        <dbx-error dbxActionError></dbx-error>
      </div>
    </dbx-dialog-content>
  `
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
            const isSame = current.message === value.message && current.signed === value.signed && current.published === value.published;
            return isSame;
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
