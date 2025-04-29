import { NgModule } from '@angular/core';
import { DbxFirebaseCollectionChangeDirective } from './store.collection.change.directive';
import { DbxFirebaseCollectionHasChangeDirective } from './store.collection.change.if.directive';
import { DbxFirebaseCollectionListDirective } from './store.collection.list.directive';
import { DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective } from './store.document.twoway.key.source.directive';
import { DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective } from './store.document.twoway.key.directive';

const importsAndExports = [DbxFirebaseCollectionListDirective, DbxFirebaseCollectionChangeDirective, DbxFirebaseCollectionHasChangeDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective, DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseModelStoreModule {}
