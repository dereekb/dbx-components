import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '@dereekb/dbx-firebase';
import { APP_CODE_PREFIXFirestoreCollections, Profile, ProfileDocument, ProfileFunctions } from 'APP_CODE_PREFIX_LOWER-firebase';

@Injectable()
export class ProfileDocumentStore extends AbstractDbxFirebaseDocumentStore<Profile, ProfileDocument> {
  readonly profileFunctions = inject(ProfileFunctions);

  constructor(collections: APP_CODE_PREFIXFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }

  readonly updateProfile = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.updateProfile);
  readonly updateProfileUsername = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.updateProfileUsername);
  readonly finishOnboarding = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.onboard);
  readonly createTestNotification = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.createTestNotification);
}
