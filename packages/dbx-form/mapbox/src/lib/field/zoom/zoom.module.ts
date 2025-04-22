import { NgModule } from '@angular/core';
import { DbxFormMapboxZoomFieldComponent } from './zoom.field.component';
import { FormlyModule } from '@ngx-formly/core';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';

const importsAndExports = [DbxFormMapboxZoomFieldComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'mapbox-zoom-picker', component: DbxFormMapboxZoomFieldComponent, wrappers: ['style', 'form-field'] }]
    }),
    NgxMapboxGLModule
  ],
  exports: importsAndExports
})
export class DbxFormMapboxZoomModule {}
