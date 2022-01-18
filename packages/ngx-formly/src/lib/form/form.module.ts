import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DbNgxFormGroupErrorsDirective } from './control.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { DbNgxActionFormDirective } from './form.action.directive';
import { DbNgxFormLoadingPairSourceDirective } from './form.loading.directive';
import { DbNgxFormlyComponent } from './formly.component';
import { FormComponentFieldComponent } from './fields/component.field.component';
import { DbNgxActionFormSafetyDirective } from './form.action.safety.directive';
import { DbNgxFormValueChangesDirective } from './form.changes.directive';
import { DbNgxFormWrapperModule } from './fields/wrappers/form.wrapper.module';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { DbNgxFormSourceDirective } from './form.input.directive';
import { DbNgxFormSpacerComponent } from './form.spacer.component';
import { FormlyModule } from '@ngx-formly/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DbNgxFormWrapperModule,
    FormlyModule.forChild({
      types: [
        { name: 'component', component: FormComponentFieldComponent }
      ]
    }),
    FormlyMatToggleModule,
    // Material
    MatCheckboxModule,
    MatSelectModule,
    MatOptionModule,
    MatInputModule,
    MatDatepickerModule,
    MatAutocompleteModule,
    MatNativeDateModule,
    MatChipsModule,
    MatIconModule
  ],
  declarations: [
    DbNgxFormlyComponent,
    DbNgxFormGroupErrorsDirective,
    DbNgxFormValueChangesDirective,
    DbNgxActionFormDirective,
    DbNgxActionFormSafetyDirective,
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
    DbNgxFormGroupErrorsDirective,
    DbNgxFormValueChangesDirective,
    DbNgxActionFormDirective,
    DbNgxActionFormSafetyDirective,
    DbNgxFormSourceDirective,
    DbNgxFormLoadingPairSourceDirective,
    DbNgxFormSpacerComponent
  ]
})
export class DbNgxFormModule { }
