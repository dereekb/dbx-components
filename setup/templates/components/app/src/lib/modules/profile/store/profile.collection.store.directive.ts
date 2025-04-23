import { Directive } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '@dereekb/dbx-firebase';
import { Profile, ProfileDocument } from 'APP_CODE_PREFIX_LOWER-firebase';
import { ProfileCollectionStore } from './profile.collection.store';

@Directive({
  selector: '[APP_CODE_PREFIX_LOWERProfileCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(APP_CODE_PREFIXProfileCollectionStoreDirective, ProfileCollectionStore)
})
export class APP_CODE_PREFIXProfileCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<Profile, ProfileDocument, ProfileCollectionStore> {
  constructor(store: ProfileCollectionStore) {
    super(store);
  }
}
