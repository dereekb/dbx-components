import { NgModule } from '@angular/core';
import { provideFormlyContext } from './formly.context';
import { DbxFormlyComponent } from './formly.form.component';

/**
 * Default template for a view that extends AbstractFormlyFormDirective.
 */
export const DBX_FORMLY_FORM_COMPONENT_TEMPLATE = `<dbx-formly></dbx-formly>`;

/**
 * Default providers for a view that extends AbstractFormlyFormDirective.
 */
export const dbxFormlyFormComponentProviders = provideFormlyContext;

const dbxFormlyFormComponentImports = [DbxFormlyComponent];

/**
 * Default imports module for a view that extends AbstractFormlyFormDirective.
 */
@NgModule({
  imports: dbxFormlyFormComponentImports,
  exports: dbxFormlyFormComponentImports
})
export class DbxFormlyFormComponentImportsModule {}
