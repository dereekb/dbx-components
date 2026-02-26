import { DbxFormFormlyTextEditorFieldModule } from './texteditor/texteditor.field.module';
import { NgModule } from '@angular/core';
import { DbxFormFormlyChecklistItemFieldModule } from './checklist/checklist.item.field.module';
import { DbxFormFormlyComponentFieldModule } from './component/component.field.module';
import { DbxFormFormlyWrapperModule } from './wrapper/wrapper.module';

const importsAndExports = [DbxFormFormlyChecklistItemFieldModule, DbxFormFormlyComponentFieldModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyWrapperModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlyFieldModule {}
