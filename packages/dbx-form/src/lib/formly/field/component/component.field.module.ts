import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormComponentFieldComponent } from './component.field.component';

const importsAndExports = [DbxFormComponentFieldComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'component', component: DbxFormComponentFieldComponent }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyComponentFieldModule {}
