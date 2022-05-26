import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormComponentFieldComponent } from './component.field.component';

@NgModule({
  imports: [
    CommonModule,
    DbxInjectionComponentModule,
    FormlyModule.forChild({
      types: [{ name: 'component', component: DbxFormComponentFieldComponent }]
    })
  ],
  declarations: [DbxFormComponentFieldComponent],
  exports: [DbxFormComponentFieldComponent]
})
export class DbxFormFormlyComponentFieldModule {}
