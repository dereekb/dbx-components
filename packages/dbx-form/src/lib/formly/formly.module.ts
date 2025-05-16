import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbxFormlyComponent } from './formly.form.component';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormlyFieldsContextDirective } from './formly.context.directive';

/**
 * @deprecated
 */
@NgModule({
  imports: [DbxFormlyComponent, DbxFormlyFieldsContextDirective, CommonModule, FormsModule, ReactiveFormsModule, FormlyModule, FormlyMatToggleModule],
  exports: [
    // Modules (?)
    FormsModule,
    ReactiveFormsModule,
    // Directives
    DbxFormlyComponent,
    DbxFormlyFieldsContextDirective
  ]
})
export class DbxFormlyModule {}
