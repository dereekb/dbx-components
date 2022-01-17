import { NgModule } from '@angular/core';
import { DbNgxActionButtonTriggerDirective, DbNgxActionButtonDirective } from './action';
import { DbNgxButtonDirective } from './button.directive';
import { DbNgxLoadingButtonDirective } from './button.loading.directive';

@NgModule({
  imports: [],
  declarations: [
    DbNgxButtonDirective,
    DbNgxLoadingButtonDirective,
    DbNgxActionButtonTriggerDirective,
    DbNgxActionButtonDirective,
  ],
  exports: [
    DbNgxButtonDirective,
    DbNgxLoadingButtonDirective,
    DbNgxActionButtonTriggerDirective,
    DbNgxActionButtonDirective,
  ],
})
export class DbNgxCoreButtonModule { }
