import { DbxFormIoModule } from './io/form.io.module';
import { DbxFormActionModule } from './action/form.action.module';
import { DbxFormActionTransitionModule } from './action/transition/form.action.transition.module';
import { NgModule } from '@angular/core';

@NgModule({
  exports: [
    DbxFormActionTransitionModule,
    DbxFormActionModule,
    DbxFormIoModule
  ]
})
export class DbxFormModule { }
