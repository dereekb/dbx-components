import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormComponentFieldComponent } from './component.field.component';

@NgModule({
  imports: [
    CommonModule,
    DbxInjectedComponentModule,
    FormlyModule.forChild({
      types: [
        { name: 'component', component: DbxFormComponentFieldComponent }
      ]
    })
  ],
  declarations: [
    DbxFormComponentFieldComponent
  ],
  exports: [
    DbxFormComponentFieldComponent
  ]
})
export class DbxFormFormlyComponentFieldModule { }
