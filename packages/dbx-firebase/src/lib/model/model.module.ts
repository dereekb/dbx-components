import { NgModule } from "@angular/core";
import { DbxFirebaseModelStoreModule } from "./store/model.store.module";

@NgModule({
  exports: [
    DbxFirebaseModelStoreModule
  ]
})
export class DbxFirebaseModelModule { }
