import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DbNgxFormlyComponent } from './formly.component';
import { FormComponentFieldComponent } from './fields/component/component.field.component';
import { DbNgxFormValueChangesDirective } from './form.changes.directive';
import { DbNgxFormWrapperModule } from './fields/wrappers/form.wrapper.module';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { DbNgxFormSourceDirective } from './form.input.directive';
import { DbNgxFormSpacerComponent } from '../layout/form.spacer.component';
import { FormlyModule } from '@ngx-formly/core';
import { DbNgxFormLoadingPairSourceDirective } from './loading/form.loading.directive';

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
    DbNgxFormSourceDirective,
    DbNgxFormLoadingPairSourceDirective,
    FormComponentFieldComponent,
    DbNgxFormSpacerComponent
  ],
  exports: [
    // Modules (?)
    FormsModule,
    ReactiveFormsModule,
    DbNgxFormWrapperModule,
    // Directives
    DbNgxFormlyComponent,
    DbNgxFormValueChangesDirective,
    DbNgxFormSourceDirective,
    DbNgxFormLoadingPairSourceDirective,
    DbNgxFormSpacerComponent
  ]
})
export class DbNgxFormModule { }
