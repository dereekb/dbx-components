import { type WorkUsingContext } from '@dereekb/rxjs';
import { Component, type OnInit, inject } from '@angular/core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { randomNumber } from '@dereekb/util';
import { DemoDevelopmentFunctions } from 'demo-firebase';
import { ProfileDocumentStore } from '../profile';
import { GuestbookDocumentStore } from '../guestbook';
import { DbxActionDirective, DbxActionValueDirective, DbxActionHandlerDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxErrorComponent, DbxActionErrorDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './setup.widget.component.html',
  providers: [ProfileDocumentStore, GuestbookDocumentStore],
  standalone: true,
  imports: [DbxActionDirective, DbxActionValueDirective, DbxActionHandlerDirective, DbxButtonComponent, DbxActionButtonDirective, DbxErrorComponent, DbxActionErrorDirective]
})
export class DemoSetupDevelopmentWidgetComponent implements OnInit {
  readonly profileDocumentStore = inject(ProfileDocumentStore);
  readonly guestbookDocumentStore = inject(GuestbookDocumentStore);
  readonly developmentFunctions = inject(DemoDevelopmentFunctions);
  readonly auth = inject(DbxFirebaseAuthService);

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.uid$);
  }

  readonly handleCreateGuestbook: WorkUsingContext = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.guestbookDocumentStore.createGuestbook({ name: `My New Guestbook ${randomNumber(999)}`, published: true }));
  };

  readonly handleCreateTwentyGuestbooks: WorkUsingContext = (value, context) => {
    context.startWorking();

    for (let i = 0; i < 20; i += 1) {
      this.guestbookDocumentStore.createGuestbook({ name: `My New Guestbook ${randomNumber(999)}`, published: true }).subscribe();
    }

    context.success();
  };

  // Seeds the resume-check prompt the profile view's resume upload runs against. A prompt lives in
  // Firestore, so a fresh emulator has none and every resume check would fail on prompt resolution
  // until this is run once. Idempotent.
  readonly handleSeedOpenRouterPrompts: WorkUsingContext = (value, context) => {
    context.startWorkingWithPromise(this.developmentFunctions.seedOpenRouterPrompts({}));
  };
}
