import type { FieldMeta } from '@ng-forge/dynamic-forms';
import { DbxForgeFieldFunctionDef, DbxForgeFieldFunctionFieldDefBuilderFunctionInstance } from './field';
import { FieldAutocompleteAttributeOptionRef, fieldAutocompleteAttributeValue } from '../../field/field.autocomplete';

export function configureForgeAutocompleteFieldMeta<C extends DbxForgeFieldFunctionDef<any> & FieldAutocompleteAttributeOptionRef>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>): void {
  const fieldDef = instance.getFieldDef();

  if ('autocomplete' in fieldDef) {
    const meta = fieldAutocompleteAttributeValue(fieldDef['autocomplete']);

    if (meta) {
      instance.addMeta(meta as unknown as FieldMeta);
    }
  }
}
