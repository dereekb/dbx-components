import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Profile, ProfileDocument } from 'demo-firebase';

@Injectable()
export class ProfileCollectionStore extends AbstractDbxFirebaseCollectionStore<Profile, ProfileDocument> {
  constructor(collections: DemoFirestoreCollections) {
    super({ firestoreCollection: collections.profileCollection });
  }
}
