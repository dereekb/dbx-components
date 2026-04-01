import { importProvidersFrom } from '@angular/core';
import { DbxFormFormlyArrayFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyDbxListFieldModule, DbxFormFormlyDurationFieldModule, DbxFormFormlyNumberFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule, DbxFormFormlySourceSelectModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule } from './field';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyModule } from '@ngx-formly/core';

/**
 * Registers all dbx-form Formly field types, wrappers, and the core Formly + Material modules as providers.
 *
 * @returns Environment providers for all Formly field declarations
 */
export function provideDbxFormFormlyFieldDeclarations() {
  return importProvidersFrom([DbxFormFormlyArrayFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyDbxListFieldModule, DbxFormFormlyDurationFieldModule, DbxFormFormlyNumberFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule, DbxFormFormlySourceSelectModule, DbxFormFormlyTextEditorFieldModule, DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule, FormlyModule, FormlyMaterialModule]);
}
