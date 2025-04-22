import { NgModule } from '@angular/core';
import { DbxActionFormDirective } from './form.action.directive';

/**
 * @deprecated Import DbxActionFormDirective directly instead.
 */
@NgModule({
  imports: [DbxActionFormDirective],
  exports: [DbxActionFormDirective]
})
export class DbxFormActionModule {}
