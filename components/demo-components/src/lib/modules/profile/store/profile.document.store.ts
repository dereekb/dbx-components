import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore } from '@dereekb/dbx-firebase';
import { UpdateProfileParams, DemoFirestoreCollections, Profile, ProfileDocument, ProfileFunctions, SetProfileUsernameParams, profileSetUsernameKey } from '@dereekb/demo-firebase';
import { LoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { from, Observable } from 'rxjs';

@Injectable()
export class ProfileDocumentStore extends AbstractDbxFirebaseDocumentStore<Profile, ProfileDocument> {
  constructor(readonly profileFunctions: ProfileFunctions, collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }

  setProfileUsername(params: SetProfileUsernameParams): Observable<LoadingState<void>> {
    return loadingStateFromObs(from(this.profileFunctions[profileSetUsernameKey](params)));
  }

  updateProfile(params: UpdateProfileParams): Observable<LoadingState<void>> {
    return loadingStateFromObs(from(this.profileFunctions.updateProfile(params)));
  }
}
