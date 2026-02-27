import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { APP_CODE_PREFIXFirestoreCollections, Profile, ProfileDocument } from 'FIREBASE_COMPONENTS_NAME';

@Injectable()
export class ProfileCollectionStore extends AbstractDbxFirebaseCollectionStore<Profile, ProfileDocument> {
  constructor() {
    super({ firestoreCollection: inject(APP_CODE_PREFIXFirestoreCollections).profileCollection });
  }
}
