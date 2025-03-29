import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbxFormlyFormComponent } from './formly.form.component';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormlyFieldsContextDirective } from './formly.context.directive';

@NgModule({
  imports: [DbxFormlyFormComponent, DbxFormlyFieldsContextDirective, CommonModule, FormsModule, ReactiveFormsModule, FormlyModule, FormlyMatToggleModule],
  exports: [
    // Modules (?)
    FormsModule,
    ReactiveFormsModule,
    // Directives
    DbxFormlyFormComponent,
    DbxFormlyFieldsContextDirective
  ]
})
export class DbxFormlyModule {}
