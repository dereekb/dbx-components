import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '@dereekb/dbx-firebase';
import { APP_CODE_PREFIXFirestoreCollections, Profile, ProfileDocument, ProfileFunctions } from 'FIREBASE_COMPONENTS_NAME';

@Injectable()
export class ProfileDocumentStore extends AbstractDbxFirebaseDocumentStore<Profile, ProfileDocument> {
  readonly profileFunctions = inject(ProfileFunctions);

  constructor() {
    super({ firestoreCollection: inject(APP_CODE_PREFIXFirestoreCollections).profileCollection });
  }

  readonly updateProfile = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.update);
}
