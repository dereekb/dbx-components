import { NgModule } from "@angular/core";
import { DbxFirebaseCollectionChangeDirective } from "./store.collection.change.directive";
import { DbxFirebaseCollectionHasChangeDirective } from "./store.collection.change.if.directive";
import { DbxFirebaseCollectionListDirective } from "./store.collection.list.directive";
import { DbxFirebaseDocumentAuthIdDirective } from "./store.document.auth.directive";
import { DbxFirebaseDocumentStoreRouteIdDirective } from "./store.document.router.directive";

@NgModule({
  imports: [],
  declarations: [
    DbxFirebaseCollectionListDirective,
    DbxFirebaseCollectionChangeDirective,
    DbxFirebaseCollectionHasChangeDirective,
    DbxFirebaseDocumentStoreRouteIdDirective,
    DbxFirebaseDocumentAuthIdDirective
  ],
  exports: [
    DbxFirebaseCollectionListDirective,
    DbxFirebaseCollectionChangeDirective,
    DbxFirebaseCollectionHasChangeDirective,
    DbxFirebaseDocumentStoreRouteIdDirective,
    DbxFirebaseDocumentAuthIdDirective
  ]
})
export class DbxFirebaseModelStoreModule { }
