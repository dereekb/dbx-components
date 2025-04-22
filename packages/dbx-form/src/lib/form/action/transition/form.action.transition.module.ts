import { NgModule } from '@angular/core';
import { DbxActionFormSafetyDirective } from './form.action.transition.safety.directive';

/**
 * @deprecated import DbxActionFormSafetyDirective directly
 */
@NgModule({
  imports: [DbxActionFormSafetyDirective],
  exports: [DbxActionFormSafetyDirective]
})
export class DbxFormActionTransitionModule {}
