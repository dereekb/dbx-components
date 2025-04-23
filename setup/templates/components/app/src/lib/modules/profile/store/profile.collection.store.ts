import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { APP_CODE_PREFIXFirestoreCollections, Profile, ProfileDocument } from 'APP_CODE_PREFIX_LOWER-firebase';

@Injectable()
export class ProfileCollectionStore extends AbstractDbxFirebaseCollectionStore<Profile, ProfileDocument> {
  constructor(collections: APP_CODE_PREFIXFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }
}
