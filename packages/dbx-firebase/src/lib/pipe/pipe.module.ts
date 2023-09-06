import { NgModule } from '@angular/core';
import { FlatFirestoreModelKeyPipe, TwoWayFlatFirestoreModelKeyPipe } from './key.pipe';

const declarations = [FlatFirestoreModelKeyPipe, TwoWayFlatFirestoreModelKeyPipe];

@NgModule({
  declarations,
  exports: declarations
})
export class DbxFirebasePipeModule {}
