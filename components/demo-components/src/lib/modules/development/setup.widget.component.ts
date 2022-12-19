import { HandleActionWithContext } from '@dereekb/dbx-core';
import { Component, OnInit } from '@angular/core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { randomNumber } from '@dereekb/util';
import { ProfileDocumentStore } from '../profile';
import { GuestbookDocumentStore } from '../guestbook';

@Component({
  templateUrl: './setup.widget.component.html',
  providers: [ProfileDocumentStore, GuestbookDocumentStore]
})
export class DemoSetupDevelopmentWidgetComponent implements OnInit {
  constructor(
    //
    readonly profileDocumentStore: ProfileDocumentStore,
    readonly guestbookDocumentStore: GuestbookDocumentStore,
    readonly auth: DbxFirebaseAuthService
  ) {}

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.uid$);
  }

  readonly handleCreateGuestbook: HandleActionWithContext = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.guestbookDocumentStore.createGuestbook({ name: `My New Guestbook ${randomNumber(999)}`, published: true }));
  };
}
