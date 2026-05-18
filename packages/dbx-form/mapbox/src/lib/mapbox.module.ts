/* eslint-disable @typescript-eslint/no-deprecated -- aggregator NgModule for the deprecated mapbox formly modules; replacement is provideDbxForgeMapboxFieldDeclarations() */
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
