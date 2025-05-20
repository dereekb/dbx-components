import { importProvidersFrom } from '@angular/core';
import { DbxFormFormlyValueModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlySelectionModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyWrapperModule } from './field';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyModule } from '@ngx-formly/core';

export function provideDbxFormFormlyFieldDeclarations() {
  return importProvidersFrom([DbxFormFormlyValueModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlySelectionModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyWrapperModule, FormlyModule, FormlyMaterialModule]);
}
