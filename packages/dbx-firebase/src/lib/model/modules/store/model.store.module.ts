import { NgModule } from '@angular/core';
import { DbxFirebaseCollectionChangeDirective } from './store.collection.change.directive';
import { DbxFirebaseCollectionHasChangeDirective } from './store.collection.change.if.directive';
import { DbxFirebaseCollectionListDirective } from './store.collection.list.directive';
import { DbxFirebaseDocumentAuthIdDirective } from './store.document.auth.directive';
import { DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective } from './store.document.twoway.key.source.directive';
import { DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective } from './store.document.twoway.key.directive';

const declarations = [DbxFirebaseCollectionListDirective, DbxFirebaseCollectionChangeDirective, DbxFirebaseCollectionHasChangeDirective, DbxFirebaseDocumentAuthIdDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective, DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective];

@NgModule({
  imports: [],
  declarations,
  exports: declarations
})
export class DbxFirebaseModelStoreModule {}
