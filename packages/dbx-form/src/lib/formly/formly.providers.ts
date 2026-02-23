import { importProvidersFrom } from '@angular/core';
import { DbxFormFormlyArrayFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyDbxListFieldModule, DbxFormFormlyNumberFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule, DbxFormFormlySourceSelectModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule } from './field';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyModule } from '@ngx-formly/core';

export function provideDbxFormFormlyFieldDeclarations() {
  return importProvidersFrom([DbxFormFormlyArrayFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyDbxListFieldModule, DbxFormFormlyNumberFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule, DbxFormFormlySourceSelectModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule, FormlyModule, FormlyMaterialModule]);
}
