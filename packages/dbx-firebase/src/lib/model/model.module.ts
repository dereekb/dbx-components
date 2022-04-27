import { NgModule } from "@angular/core";
import { DbxFirebaseModelLoaderModule } from "./loader/model.loader.module";

@NgModule({
  exports: [
    DbxFirebaseModelLoaderModule
  ]
})
export class DbxFirebaseModelModule { }
