import { OnDestroy, OnInit, Component } from '@angular/core';
import { HandleActionFunction } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { IsModifiedFunction, loadingStateContext } from '@dereekb/rxjs';
import { first, map } from 'rxjs';
import { DemoProfileFormValue, DemoProfileUsernameFormValue, ProfileDocumentStore } from '../../../../shared';

@Component({
  templateUrl: './profile.component.html',
  providers: [ProfileDocumentStore]
})
export class DemoProfileViewComponent implements OnInit, OnDestroy {

  readonly profileData$ = this.profileDocumentStore.data$;
  readonly username$ = this.profileData$.pipe(map(x => x.username));
  
  readonly context = loadingStateContext({ obs: this.profileDocumentStore.dataLoadingState$ });

  constructor(readonly profileDocumentStore: ProfileDocumentStore, readonly auth: DbxFirebaseAuthService) { }

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
  }

  ngOnDestroy(): void { }

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
  }

  readonly isProfileModified: IsModifiedFunction<DemoProfileFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        if (profileData) {
          return profileData.bio !== value.bio
        } else {
          return true;
        }
      }),
      first()
    );
  }

  handleChangeUsername: HandleActionFunction = (form: DemoProfileUsernameFormValue, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.setProfileUsername(form));
  };

  handleUpdateProfile: HandleActionFunction = (form: DemoProfileFormValue, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfile(form));
  };

}
