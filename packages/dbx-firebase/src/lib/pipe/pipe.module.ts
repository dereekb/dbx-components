import { NgModule } from '@angular/core';
import { TwoWayFlatFirestoreModelKeyPipe } from './key.twoway.pipe';
import { FlatFirestoreModelKeyPipe } from './key.flat.pipe';

const importsAndExports = [FlatFirestoreModelKeyPipe, TwoWayFlatFirestoreModelKeyPipe];

/**
 * Imports and exports all DbxFirebasePipe components.
 *
 * @deprecated consider importing the individual pipes instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebasePipeModule {}
