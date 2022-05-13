import { NgModule } from "@angular/core";
import { DbxFirebaseModelModule } from "./model/model.module";

@NgModule({
  exports: [
    DbxFirebaseModelModule
  ]
})
export class DbxFirebaseModule { }
