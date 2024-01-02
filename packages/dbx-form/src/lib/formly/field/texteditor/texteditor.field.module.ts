import { DbxTextModule } from '@dereekb/dbx-web';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormlyModule } from '@ngx-formly/core';
import { NgxEditorModule } from 'ngx-editor';
import { DbxTextEditorFieldComponent } from './texteditor.field.component';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    FormsModule,
    ReactiveFormsModule,
    NgxEditorModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    FormlyModule.forChild({
      types: [{ name: 'texteditor', component: DbxTextEditorFieldComponent }]
    })
  ],
  declarations: [DbxTextEditorFieldComponent],
  exports: []
})
export class DbxFormFormlyTextEditorFieldModule {}
