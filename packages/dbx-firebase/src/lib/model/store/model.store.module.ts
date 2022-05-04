import { NgModule } from "@angular/core";
import { DbxFirebaseCollectionListDirective } from "./store.collection.list.directive";
import { DbxFirebaseDocumentStoreRouteIdDirective } from "./store.document.router.directive";

@NgModule({
  imports: [],
  declarations: [
    DbxFirebaseCollectionListDirective,
    DbxFirebaseDocumentStoreRouteIdDirective
  ],
  exports: [
    DbxFirebaseCollectionListDirective,
    DbxFirebaseDocumentStoreRouteIdDirective
  ]
})
export class DbxFirebaseModelStoreModule { }
