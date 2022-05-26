import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxWindowKeyDownListenerDirective } from './keydown.listener.directive';

@NgModule({
  imports: [CommonModule],
  declarations: [DbxWindowKeyDownListenerDirective],
  exports: [DbxWindowKeyDownListenerDirective]
})
export class DbxKeypressModule {}
