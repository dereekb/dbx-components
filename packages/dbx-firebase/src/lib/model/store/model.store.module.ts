import { NgModule } from '@angular/core';
import { DbxFirebaseCollectionChangeDirective } from './store.collection.change.directive';
import { DbxFirebaseCollectionHasChangeDirective } from './store.collection.change.if.directive';
import { DbxFirebaseCollectionListDirective } from './store.collection.list.directive';
import { DbxFirebaseDocumentAuthIdDirective } from './store.document.auth.directive';
import { DbxFirebaseDocumentStoreRouteIdDirective } from './store.document.router.directive';
import { DbxFirebaseDocumentStoreRouteKeyDirective } from './store.document.router.key.directive';

const declarations = [DbxFirebaseDocumentStoreRouteKeyDirective, DbxFirebaseCollectionListDirective, DbxFirebaseCollectionChangeDirective, DbxFirebaseCollectionHasChangeDirective, DbxFirebaseDocumentStoreRouteIdDirective, DbxFirebaseDocumentAuthIdDirective];

@NgModule({
  imports: [],
  declarations,
  exports: declarations
})
export class DbxFirebaseModelStoreModule {}
