import { OnInit, Component, inject } from '@angular/core';
import { DbxActionSuccessHandlerFunction, DbxRouterService } from '@dereekb/dbx-core';
import { WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { ProfileDocumentStore } from 'demo-components';
import { DbxContentBoxDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.box.directive';
import { DbxActionDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxActionValueDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.value.directive';
import { DbxActionHandlerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.handler.directive';
import { DbxActionSuccessHandlerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.success.handler.directive';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxActionButtonDirective } from '../../../../../../../../../packages/dbx-core/src/lib/button/action/action.button.directive';
import { DbxErrorComponent } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.component';
import { DbxActionErrorDirective } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.action.directive';

@Component({
    template: `
    <dbx-content-box>
      <h2>Onboard User</h2>
      <p>Demo showing onboarding state.</p>
      <div dbxAction dbxActionValue [dbxActionHandler]="handleCompleteOnboarding" [dbxActionSuccessHandler]="handleSuccess">
        <dbx-button [raised]="true" text="Accept ToS" dbxActionButton></dbx-button>
        <dbx-error dbxActionError></dbx-error>
      </div>
    </dbx-content-box>
  `,
    providers: [ProfileDocumentStore],
    standalone: true,
    imports: [DbxContentBoxDirective, DbxActionDirective, DbxActionValueDirective, DbxActionHandlerDirective, DbxActionSuccessHandlerDirective, DbxButtonComponent, DbxActionButtonDirective, DbxErrorComponent, DbxActionErrorDirective]
})
export class DemoOnboardUserComponent implements OnInit {
  readonly profileDocumentStore = inject(ProfileDocumentStore);
  readonly auth = inject(DbxFirebaseAuthService);
  readonly dbxRouterService = inject(DbxRouterService);

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
  }

  readonly handleCompleteOnboarding: WorkUsingContext = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.finishOnboarding({}));
  };

  readonly handleSuccess: DbxActionSuccessHandlerFunction = () => {
    this.auth.refreshToken().then(() => {
      this.dbxRouterService.go('demo.app');
    });
  };
}
