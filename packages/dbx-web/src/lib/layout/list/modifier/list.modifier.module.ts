import { NgModule } from '@angular/core';
import { DbxValueListItemModifierDirective } from './list.view.value.modifier.directive';
import { DbxListItemDisableRippleModifierDirective } from './list.view.value.modifier.ripple.directive';
import { DbxListItemIsSelectedModifierDirective } from './list.view.value.modifier.selection.directive';

const importsAndExports = [DbxValueListItemModifierDirective, DbxListItemDisableRippleModifierDirective, DbxListItemIsSelectedModifierDirective];

/**
 * Exports all dbx-list modifier-related directives.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxListModifierModule {}
