import { Directive, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { type FormSpace, type FormSpaceDocument } from '@dereekb/firebase';
import { FormSpaceCollectionStore } from './formspace.collection.store';

@Directive({
  selector: '[dbxFirebaseFormSpaceCollection]',
  exportAs: 'dbxFirebaseFormSpaceCollection',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseFormSpaceCollectionStoreDirective, FormSpaceCollectionStore),
  standalone: true
})
export class DbxFirebaseFormSpaceCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<FormSpace, FormSpaceDocument, FormSpaceCollectionStore> {
  constructor() {
    super(inject(FormSpaceCollectionStore));
    this.setConstraints([]);
  }
}
