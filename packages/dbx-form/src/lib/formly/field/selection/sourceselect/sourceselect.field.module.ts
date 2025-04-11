import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormSourceSelectFieldComponent } from './sourceselect.field.component';

@NgModule({
  imports: [
    DbxFormSourceSelectFieldComponent,
    FormlyModule.forChild({
      types: [{ name: 'sourceselectfield', component: DbxFormSourceSelectFieldComponent, wrappers: ['form-field'] }]
    })
  ],
  exports: [DbxFormSourceSelectFieldComponent]
})
export class DbxFormFormlySourceSelectModule {}
