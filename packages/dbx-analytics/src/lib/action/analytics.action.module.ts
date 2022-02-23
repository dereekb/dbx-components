import { NgModule } from '@angular/core';
import { DbxActionAnalyticsDirective } from './analytics.action.directive';

@NgModule({
  declarations: [
    DbxActionAnalyticsDirective
  ],
  exports: [
    DbxActionAnalyticsDirective
  ]
})
export class AnalyticsActionModule { }
