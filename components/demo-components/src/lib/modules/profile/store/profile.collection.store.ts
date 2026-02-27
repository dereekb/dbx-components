import { Injectable } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore } from '@dereekb/dbx-firebase';
import { DemoFirestoreCollections, Profile, ProfileDocument } from 'demo-firebase';
import { inject } from '@angular/core';

@Injectable()
export class ProfileCollectionStore extends AbstractDbxFirebaseCollectionStore<Profile, ProfileDocument> {
  constructor() {
    super({ firestoreCollection: inject(DemoFirestoreCollections).profileCollection });
  }
}
