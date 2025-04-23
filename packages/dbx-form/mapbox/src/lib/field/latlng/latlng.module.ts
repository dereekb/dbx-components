import { NgModule } from '@angular/core';
import { DbxFormMapboxLatLngFieldComponent } from './latlng.field.component';
import { FormlyModule } from '@ngx-formly/core';

const importsAndExports = [DbxFormMapboxLatLngFieldComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'mapbox-latlng-picker', component: DbxFormMapboxLatLngFieldComponent, wrappers: ['style', 'form-field'] }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormMapboxLatLngModule {}
