import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxWindowKeyDownListenerDirective } from './keydown.listener.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxWindowKeyDownListenerDirective
  ],
  exports: [
    DbNgxWindowKeyDownListenerDirective
  ]
})
export class DbNgxKeypressModule { }
