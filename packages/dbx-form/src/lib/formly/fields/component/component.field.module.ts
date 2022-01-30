import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { FormComponentFieldComponent } from './component.field.component';

@NgModule({
  imports: [
    CommonModule,
    FormlyModule.forChild({
      types: [
        { name: 'component', component: FormComponentFieldComponent }
      ]
    })
  ],
  declarations: [
    FormComponentFieldComponent
  ],
  exports: [
    FormComponentFieldComponent
  ]
})
export class DbxComponentFieldModule { }
