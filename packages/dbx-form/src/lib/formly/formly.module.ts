import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbxFormlyComponent } from './formly.component';
import { FormComponentFieldComponent } from './fields/component/component.field.component';
import { DbxFormValueChangesDirective } from '../form/form.changes.directive';
import { DbxFormWrapperModule } from './fields/wrappers/form.wrapper.module';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { FormlyModule } from '@ngx-formly/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DbxFormWrapperModule,
    FormlyModule,
    FormlyMatToggleModule
  ],
  declarations: [
    DbxFormlyComponent,
    DbxFormValueChangesDirective,
    FormComponentFieldComponent
  ],
  exports: [
    // Modules (?)
    FormsModule,
    ReactiveFormsModule,
    DbxFormWrapperModule,
    // Directives
    DbxFormlyComponent,
    DbxFormValueChangesDirective,
    FormComponentFieldComponent
  ]
})
export class DbxFormlyModule { }
