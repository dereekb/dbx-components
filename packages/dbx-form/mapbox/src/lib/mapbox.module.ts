import { NgModule } from '@angular/core';
import { DbxFormMapboxZoomModule } from './field';
import { DbxFormMapboxLatLngModule } from './field/latlng/latlng.module';

/**
 * @deprecated Use provideDbxForgeMapboxFieldDeclarations() instead.
 */
@NgModule({
  exports: [DbxFormMapboxLatLngModule, DbxFormMapboxZoomModule]
})
export class DbxFormMapboxModule {}
