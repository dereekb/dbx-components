import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { HandleActionWithContext } from '@dereekb/dbx-core';
import { DemoGuestbookEntryFormValue, GuestbookEntryDocumentStore } from '@dereekb/demo-components';
import { IsModifiedFunction } from '@dereekb/rxjs';
import { map, of, switchMap } from 'rxjs';

export interface DemoGuestbookEntryPopupComponentConfig {
  guestbookEntryDocumentStore: GuestbookEntryDocumentStore;
}

@Component({
  template: `
  <dbx-dialog-content>
    <p class="dbx-note">Enter your message for the guest book.</p>
    <div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleUpdateEntry">
      <demo-guestbook-entry-form dbxActionForm [dbxFormSource]="data$" [dbxActionFormModified]="isFormModified"></demo-guestbook-entry-form>
      <p></p>
      <dbx-button [raised]="true" [text]="(exists$ | async) ? 'Save Changes' : 'Create Guestbook Entry'" dbxActionButton></dbx-button>
      <dbx-error dbxActionError></dbx-error>
    </div>
  </dbx-dialog-content>
  `
})
export class DemoGuestbookEntryPopupComponent extends AbstractDialogDirective<any, DemoGuestbookEntryPopupComponentConfig> {

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

  readonly isFormModified: IsModifiedFunction<DemoGuestbookEntryFormValue> = (value) => {
    return this.exists$.pipe(
      switchMap((exists) => {
        if (exists) {
          return this.data$.pipe(
            map((current) => {
              const isModified = Boolean(current.message !== value.message) || Boolean(current.signed !== value.signed) || Boolean(current.published !== value.published);
              return isModified;
            }));
        } else {
          return of(true);
        }
      })
    );
  }

  readonly handleUpdateEntry: HandleActionWithContext<DemoGuestbookEntryFormValue, void> = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.guestbookEntryDocumentStore.updateEntry(value));
  }

}
