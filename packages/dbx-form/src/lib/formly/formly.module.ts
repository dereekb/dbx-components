import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbxFormlyComponent } from './formly.component';
// import { FormComponentFieldComponent } from './fields/component/component.field.component';
// import { DbxFormWrapperModule } from './fields/wrappers/form.wrapper.module';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { FormlyModule } from '@ngx-formly/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FormlyModule,
    FormlyMatToggleModule
  ],
  declarations: [
    DbxFormlyComponent,
    // FormComponentFieldComponent
  ],
  exports: [
    // Modules (?)
    FormsModule,
    ReactiveFormsModule,
    // DbxFormWrapperModule, // todo!
    // Directives
    DbxFormlyComponent,
    // FormComponentFieldComponent
  ]
})
export class DbxFormlyModule { }
