import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Profile, ProfileDocument, ProfileFunctions } from '@dereekb/demo-firebase';

@Injectable()
export class ProfileDocumentStore extends AbstractDbxFirebaseDocumentStore<Profile, ProfileDocument> {
  constructor(readonly profileFunctions: ProfileFunctions, collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }

  readonly updateProfile = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.updateProfile);
  readonly updateProfileUsername = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.updateProfileUsername);
  readonly finishOnboarding = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.onboard);
}
