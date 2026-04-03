import { type EnvironmentProviders } from '@angular/core';
import { provideDynamicForm } from '@ng-forge/dynamic-forms';
import { withMaterialFields } from '@ng-forge/dynamic-forms-material';

/**
 * Registers ng-forge dynamic form field declarations with Material Design field types.
 *
 * Add this to your app's providers alongside provideDbxFormConfiguration().
 */
export function provideDbxForgeFormFieldDeclarations() {
  return provideDynamicForm(...withMaterialFields());
}
