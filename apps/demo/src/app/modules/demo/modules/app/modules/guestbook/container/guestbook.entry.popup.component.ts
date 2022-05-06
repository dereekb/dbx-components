import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { HandleActionFunction } from '@dereekb/dbx-core';
import { DemoGuestbookEntryFormValue } from '../../../../shared/modules/guestbook/component/guestbook.entry.form.component';
import { GuestbookEntryDocumentStore } from './../../../../shared/modules/guestbook/store/guestbook.entry.document.store';
import { of } from 'rxjs';

export interface DemoGuestbookEntryPopupComponentConfig {
  guestbookEntryDocumentStore: GuestbookEntryDocumentStore;
}

@Component({
  template: `
  <dbx-dialog-content>
    <p class="dbx-note">Enter your message for the guest book.</p>
    <div dbxAction [dbxActionHandler]="handleFormAction">
      <demo-guestbook-entry-form dbxActionForm></demo-guestbook-entry-form>
      <p></p>
      <dbx-button [raised]="true" [text]="(exists$ | async) ? 'Update Entry' : 'Create Entry'" dbxActionButton></dbx-button>
    </div>
  </dbx-dialog-content>
  `
})
export class DemoGuestbookEntryPopupComponent extends AbstractDialogDirective<any, DemoGuestbookEntryPopupComponentConfig> {

  get guestbookEntryDocumentStore(): GuestbookEntryDocumentStore {
    return this.data.guestbookEntryDocumentStore;
  }

  get exists$() {
    return this.guestbookEntryDocumentStore.exists$;
  }

  static openPopup(matDialog: MatDialog, config: DemoGuestbookEntryPopupComponentConfig) {
    return matDialog.open(DemoGuestbookEntryPopupComponent, {
      data: config
    });
  }

  readonly handleFormAction: HandleActionFunction = (value: DemoGuestbookEntryFormValue) => {
    console.log('save.');
    return of(false);
  }

}
