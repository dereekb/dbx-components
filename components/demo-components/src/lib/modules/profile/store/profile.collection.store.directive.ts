import { Directive } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';
import { Profile, ProfileDocument } from '@dereekb/demo-firebase';
import { ProfileCollectionStore } from './profile.collection.store';

@Directive({
  selector: '[demoProfileCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DemoProfileCollectionStoreDirective, ProfileCollectionStore)
})
export class DemoProfileCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<Profile, ProfileDocument, ProfileCollectionStore> {
  constructor(store: ProfileCollectionStore) {
    super(store);
  }
}
