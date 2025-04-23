import { NgModule } from '@angular/core';
import { DbxWindowKeyDownListenerDirective } from './keydown.listener.directive';

/**
 * @deprecated DbxWindowKeyDownListenerDirective is now standalone. Import that instead.
 */
@NgModule({
  imports: [DbxWindowKeyDownListenerDirective],
  exports: [DbxWindowKeyDownListenerDirective]
})
export class DbxKeypressModule {}
