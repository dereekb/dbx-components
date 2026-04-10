import { NgModule } from '@angular/core';
import { provideDbxForgeFormContext } from './forge.context';
import { DbxForgeFormComponent } from './forge.component';

/**
 * Default template for a view that extends AbstractSyncForgeFormDirective or AbstractConfigAsyncForgeFormDirective.
 */
export const DBX_FORGE_FORM_COMPONENT_TEMPLATE = `<dbx-forge></dbx-forge>`;

/**
 * Default providers for a view that extends AbstractSyncForgeFormDirective or AbstractConfigAsyncForgeFormDirective.
 */
export const dbxForgeFormComponentProviders = provideDbxForgeFormContext;

const dbxForgeFormComponentImports = [DbxForgeFormComponent];

/**
 * Default imports module for a view that extends AbstractSyncForgeFormDirective or AbstractConfigAsyncForgeFormDirective.
 */
@NgModule({
  imports: dbxForgeFormComponentImports,
  exports: dbxForgeFormComponentImports
})
export class DbxForgeFormComponentImportsModule {}
