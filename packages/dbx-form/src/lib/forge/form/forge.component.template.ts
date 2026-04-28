import { NgModule } from '@angular/core';
import { DbxForgeFormComponent } from './forge.component';

/**
 * Default template for a view that extends AbstractSyncForgeFormDirective or AbstractConfigAsyncForgeFormDirective.
 */
export const DBX_FORGE_FORM_COMPONENT_TEMPLATE = `<dbx-forge></dbx-forge>` as const;

/**
 * Default providers for a view that extends AbstractSyncForgeFormDirective or AbstractConfigAsyncForgeFormDirective.
 */
export { provideDbxForgeFormContext as dbxForgeFormComponentProviders } from './forge.context';

const dbxForgeFormComponentImports = [DbxForgeFormComponent];

/**
 * Default imports module for a view that extends AbstractSyncForgeFormDirective or AbstractConfigAsyncForgeFormDirective.
 */
@NgModule({
  imports: dbxForgeFormComponentImports,
  exports: dbxForgeFormComponentImports
})
export class DbxForgeFormComponentImportsModule {}
