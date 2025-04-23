import { NgModule } from '@angular/core';
import { DbxListItemAnchorModifierDirective } from './router.list.directive';

/**
 * @deprecated import DbxValueListItemModifierDirective directly instead.
 */
@NgModule({
  imports: [DbxListItemAnchorModifierDirective],
  exports: [DbxListItemAnchorModifierDirective]
})
export class DbxRouterListModule {}
