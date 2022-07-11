import { OnInit, Component } from '@angular/core';
import { DbxActionSuccessHandlerFunction, DbxRouterService, HandleActionWithContext } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { ProfileDocumentStore } from '@dereekb/demo-components';

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
  providers: [ProfileDocumentStore]
})
export class DemoOnboardUserComponent implements OnInit {
  constructor(readonly profileDocumentStore: ProfileDocumentStore, readonly auth: DbxFirebaseAuthService, readonly dbxRouterService: DbxRouterService) {}

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
  }

  readonly handleCompleteOnboarding: HandleActionWithContext = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.finishOnboarding({}));
  };

  readonly handleSuccess: DbxActionSuccessHandlerFunction = () => {
    this.auth.refreshToken().then(() => {
      this.dbxRouterService.go('demo.app');
    });
  };
}
