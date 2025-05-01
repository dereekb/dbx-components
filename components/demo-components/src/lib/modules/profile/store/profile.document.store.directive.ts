import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { Profile, ProfileDocument } from 'demo-firebase';
import { ProfileDocumentStore } from './profile.document.store';

@Directive({
    selector: '[demoProfileDocument]',
    providers: provideDbxFirebaseDocumentStoreDirective(DemoProfileDocumentStoreDirective, ProfileDocumentStore),
    standalone: true
})
export class DemoProfileDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Profile, ProfileDocument, ProfileDocumentStore> {
  constructor() {
    super(inject(ProfileDocumentStore));
  }
}
