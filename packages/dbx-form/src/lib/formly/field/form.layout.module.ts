import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormFormlyChecklistItemFieldModule } from './checklist/checklist.item.field.module';
import { DbxFormFormlyComponentFieldModule } from './component/component.field.module';
import { DbxFormFormlySelectionModule } from './selection/selection.module';
import { DbxFormFormlyTextEditorFieldModule } from './texteditor/texteditor.field.module';
import { DbxFormFormlyDateFieldModule } from './value/date/date.field.module';
import { DbxFormFormlyTextFieldModule } from './value/text/text.field.module';
import { DbxFormFormlyWrapperModule } from './wrapper/form.wrapper.module';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [],
  exports: [
    DbxFormFormlyChecklistItemFieldModule,
    DbxFormFormlyComponentFieldModule,
    DbxFormFormlySelectionModule,
    DbxFormFormlyTextEditorFieldModule,
    DbxFormFormlyDateFieldModule,
    DbxFormFormlyTextFieldModule,
    DbxFormFormlyWrapperModule
  ]
})
export class DbxFormFormlyFieldModule { }
