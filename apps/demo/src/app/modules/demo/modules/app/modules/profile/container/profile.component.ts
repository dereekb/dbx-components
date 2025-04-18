import { OnDestroy, OnInit, Component, inject } from '@angular/core';
import { WorkUsingContext, IsModifiedFunction, loadingStateContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService, DbxFirebaseStorageService } from '@dereekb/dbx-firebase';
import { first, map } from 'rxjs';
import { DemoProfileFormValue, DemoProfileUsernameFormValue, ProfileDocumentStore } from '@dereekb/demo-components';

@Component({
  templateUrl: './profile.component.html',
  providers: [ProfileDocumentStore]
})
export class DemoProfileViewComponent implements OnInit, OnDestroy {
  readonly profileDocumentStore = inject(ProfileDocumentStore);
  readonly auth = inject(DbxFirebaseAuthService);
  readonly storage = inject(DbxFirebaseStorageService);

  readonly profileData$ = this.profileDocumentStore.data$;
  readonly username$ = this.profileData$.pipe(map((x) => x.username));

  readonly context = loadingStateContext({ obs: this.profileDocumentStore.dataLoadingState$ });

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

  readonly handleChangeUsername: WorkUsingContext<DemoProfileUsernameFormValue> = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfileUsername(form));
  };

  readonly handleUpdateProfile: WorkUsingContext<DemoProfileFormValue> = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfile(form));
  };
}
