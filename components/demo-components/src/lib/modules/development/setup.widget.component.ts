import { WorkUsingContext } from '@dereekb/rxjs';
import { Component, OnInit } from '@angular/core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { randomNumber } from '@dereekb/util';
import { ProfileDocumentStore } from '../profile';
import { GuestbookDocumentStore } from '../guestbook';
import { DbxActionDirective } from '../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxActionValueDirective } from '../../../../../../packages/dbx-core/src/lib/action/directive/state/action.value.directive';
import { DbxActionHandlerDirective } from '../../../../../../packages/dbx-core/src/lib/action/directive/state/action.handler.directive';
import { DbxButtonComponent } from '../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxActionButtonDirective } from '../../../../../../packages/dbx-core/src/lib/button/action/action.button.directive';
import { DbxErrorComponent } from '../../../../../../packages/dbx-web/src/lib/error/error.component';
import { DbxActionErrorDirective } from '../../../../../../packages/dbx-web/src/lib/error/error.action.directive';

@Component({
    templateUrl: './setup.widget.component.html',
    providers: [ProfileDocumentStore, GuestbookDocumentStore],
    standalone: true,
    imports: [DbxActionDirective, DbxActionValueDirective, DbxActionHandlerDirective, DbxButtonComponent, DbxActionButtonDirective, DbxErrorComponent, DbxActionErrorDirective]
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
}
