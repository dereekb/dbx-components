import { Injectable , inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Profile, ProfileDocument } from 'demo-firebase';

@Injectable()
export class ProfileCollectionStore extends AbstractDbxFirebaseCollectionStore<Profile, ProfileDocument> {
  constructor() {
    super({ firestoreCollection: inject(DemoFirestoreCollections).profileCollection });
  }
}
