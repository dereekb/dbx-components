import { NgModule } from '@angular/core';
import { DbxActionButtonTriggerDirective, DbxActionButtonDirective } from './action';
import { DbxButtonDirective } from './button.directive';
import { DbxLoadingButtonDirective } from './button.loading.directive';
import { DbxButtonSegueDirective } from './router/button.segue.directive';

@NgModule({
  imports: [],
  declarations: [
    DbxButtonDirective,
    DbxLoadingButtonDirective,
    DbxActionButtonTriggerDirective,
    DbxActionButtonDirective,
    DbxButtonSegueDirective
  ],
  exports: [
    DbxButtonDirective,
    DbxLoadingButtonDirective,
    DbxActionButtonTriggerDirective,
    DbxActionButtonDirective,
    DbxButtonSegueDirective
  ],
})
export class DbxCoreButtonModule { }
