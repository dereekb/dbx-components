import { NgModule } from '@angular/core';
import { DbNgxActionAnalyticsDirective } from './analytics.action.directive';

@NgModule({
  declarations: [
    DbNgxActionAnalyticsDirective
  ],
  exports: [
    DbNgxActionAnalyticsDirective
  ]
})
export class AnalyticsActionModule { }
