import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { Profile, ProfileDocument } from 'APP_CODE_PREFIX_LOWER-firebase';
import { ProfileDocumentStore } from './profile.document.store';

@Directive({
  selector: '[APP_CODE_PREFIX_LOWERProfileDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(APP_CODE_PREFIXProfileDocumentStoreDirective, ProfileDocumentStore)
})
export class APP_CODE_PREFIXProfileDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Profile, ProfileDocument, ProfileDocumentStore> {
  constructor() {
    super(inject(ProfileDocumentStore));
  }
}
