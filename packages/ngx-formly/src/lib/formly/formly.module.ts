import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbNgxFormlyComponent } from './formly.component';
import { FormComponentFieldComponent } from './fields/component/component.field.component';
import { DbNgxFormValueChangesDirective } from '../form/form.changes.directive';
import { DbNgxFormWrapperModule } from './fields/wrappers/form.wrapper.module';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { FormlyModule } from '@ngx-formly/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DbNgxFormWrapperModule,
    FormlyModule,
    FormlyMatToggleModule
  ],
  declarations: [
    DbNgxFormlyComponent,
    DbNgxFormValueChangesDirective,
    FormComponentFieldComponent
  ],
  exports: [
    // Modules (?)
    FormsModule,
    ReactiveFormsModule,
    DbNgxFormWrapperModule,
    // Directives
    DbNgxFormlyComponent,
    DbNgxFormValueChangesDirective,
    FormComponentFieldComponent
  ]
})
export class DbNgxFormlyModule { }
