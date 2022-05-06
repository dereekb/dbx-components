import { NgModule } from "@angular/core";
import { DbxFirebaseCollectionListDirective } from "./store.collection.list.directive";
import { DbxFirebaseDocumentAuthIdDirective } from "./store.document.auth.directive";
import { DbxFirebaseDocumentStoreRouteIdDirective } from "./store.document.router.directive";

@NgModule({
  imports: [],
  declarations: [
    DbxFirebaseCollectionListDirective,
    DbxFirebaseDocumentStoreRouteIdDirective,
    DbxFirebaseDocumentAuthIdDirective
  ],
  exports: [
    DbxFirebaseCollectionListDirective,
    DbxFirebaseDocumentStoreRouteIdDirective,
    DbxFirebaseDocumentAuthIdDirective
  ]
})
export class DbxFirebaseModelStoreModule { }
