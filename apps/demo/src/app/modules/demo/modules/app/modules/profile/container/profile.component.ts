import { OnDestroy, OnInit, Component } from '@angular/core';
import { HandleActionWithContext } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService, DbxFirebaseStorageService } from '@dereekb/dbx-firebase';
import { IsModifiedFunction, loadingStateContext } from '@dereekb/rxjs';
import { first, map } from 'rxjs';
import { DemoProfileFormValue, DemoProfileUsernameFormValue, ProfileDocumentStore } from '@dereekb/demo-components';

@Component({
  templateUrl: './profile.component.html',
  providers: [ProfileDocumentStore]
})
export class DemoProfileViewComponent implements OnInit, OnDestroy {
  readonly profileData$ = this.profileDocumentStore.data$;
  readonly username$ = this.profileData$.pipe(map((x) => x.username));

  readonly context = loadingStateContext({ obs: this.profileDocumentStore.dataLoadingState$ });

  constructor(readonly profileDocumentStore: ProfileDocumentStore, readonly auth: DbxFirebaseAuthService, readonly storage: DbxFirebaseStorageService) {}

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
  }

  ngOnDestroy(): void {}

  readonly isUsernameModified: IsModifiedFunction<DemoProfileUsernameFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        if (profileData) {
          return profileData.username !== value.username;
        } else {
          return true;
        }
      }),
      first()
    );
  };

  readonly isProfileModified: IsModifiedFunction<DemoProfileFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        if (profileData) {
          return profileData.bio !== value.bio;
        } else {
          return true;
        }
      }),
      first()
    );
  };

  handleChangeUsername: HandleActionWithContext<DemoProfileUsernameFormValue> = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfileUsername(form));
  };

  handleUpdateProfile: HandleActionWithContext<DemoProfileFormValue> = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfile(form));
  };
}
