import { DbxFormFormlyTextEditorFieldModule } from './texteditor/texteditor.field.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormFormlyChecklistItemFieldModule } from './checklist/checklist.item.field.module';
import { DbxFormFormlyComponentFieldModule } from './component/component.field.module';
import { DbxFormFormlySelectionModule } from './selection/selection.module';
import { DbxFormFormlyWrapperModule } from './wrapper/form.wrapper.module';
import { DbxFormFormlyValueModule } from './value/value.module';

@NgModule({
  imports: [CommonModule],
  declarations: [],
  exports: [DbxFormFormlyChecklistItemFieldModule, DbxFormFormlyComponentFieldModule, DbxFormFormlySelectionModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyValueModule, DbxFormFormlyWrapperModule]
})
export class DbxFormFormlyFieldModule {}
