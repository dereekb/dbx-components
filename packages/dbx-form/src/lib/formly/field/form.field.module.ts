import { DbxFormFormlyTextEditorFieldModule } from './texteditor/texteditor.field.module';
import { NgModule } from '@angular/core';
import { DbxFormFormlyChecklistItemFieldModule } from './checklist/checklist.item.field.module';
import { DbxFormFormlyComponentFieldModule } from './component/component.field.module';
import { DbxFormFormlySelectionModule } from './selection/selection.module';
import { DbxFormFormlyWrapperModule } from './wrapper/wrapper.module';
import { DbxFormFormlyValueModule } from './value/value.module';

const importsAndExports = [DbxFormFormlyChecklistItemFieldModule, DbxFormFormlyComponentFieldModule, DbxFormFormlySelectionModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyValueModule, DbxFormFormlyWrapperModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlyFieldModule {}
