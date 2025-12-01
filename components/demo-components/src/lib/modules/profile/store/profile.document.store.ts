import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreReadFunction, firebaseDocumentStoreUpdateFunction } from '@dereekb/dbx-firebase';
import { storageFileGroupZipStorageFileKey } from '@dereekb/firebase';
import { DemoFirestoreCollections, Profile, ProfileDocument, ProfileFunctions, userProfileStorageFileGroupId } from 'demo-firebase';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';

@Injectable()
export class ProfileDocumentStore extends AbstractDbxFirebaseDocumentStore<Profile, ProfileDocument> {
  readonly profileFunctions = inject(ProfileFunctions);

  constructor(collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }

  readonly zipArchiveStorageFileKey$ = this.id$.pipe(
    map((id) => storageFileGroupZipStorageFileKey(userProfileStorageFileGroupId(id))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly updateProfile = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.updateProfile);
  readonly updateProfileUsername = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.updateProfileUsername);
  readonly finishOnboarding = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.onboard);
  readonly createTestNotification = firebaseDocumentStoreUpdateFunction(this, this.profileFunctions.profile.updateProfile.createTestNotification);

  readonly downloadArchive = firebaseDocumentStoreReadFunction(this, this.profileFunctions.profile.readProfile.downloadArchive);
}
