import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { APP_CODE_PREFIXFirestoreCollections, Profile, ProfileDocument } from 'FIREBASE_COMPONENTS_NAME';

@Injectable()
export class ProfileCollectionStore extends AbstractDbxFirebaseCollectionStore<Profile, ProfileDocument> {
  constructor(collections: APP_CODE_PREFIXFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }
}
