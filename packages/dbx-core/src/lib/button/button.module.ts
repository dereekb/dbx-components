import { NgModule } from '@angular/core';
import { DbNgxActionButtonTriggerDirective, DbNgxActionButtonDirective } from './action';
import { DbNgxButtonDirective } from './button.directive';
import { DbNgxLoadingButtonDirective } from './button.loading.directive';
import { DbNgxButtonSegueDirective } from './router/button.segue.directive';

@NgModule({
  imports: [],
  declarations: [
    DbNgxButtonDirective,
    DbNgxLoadingButtonDirective,
    DbNgxActionButtonTriggerDirective,
    DbNgxActionButtonDirective,
    DbNgxButtonSegueDirective
  ],
  exports: [
    DbNgxButtonDirective,
    DbNgxLoadingButtonDirective,
    DbNgxActionButtonTriggerDirective,
    DbNgxActionButtonDirective,
    DbNgxButtonSegueDirective
  ],
})
export class DbNgxCoreButtonModule { }
