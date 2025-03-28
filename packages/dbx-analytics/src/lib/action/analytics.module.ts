import { NgModule } from '@angular/core';
import { DbxActionAnalyticsDirective } from './analytics.action.directive';

/**
 * @deprecated The exported DbxActionAnalyticsDirective is now a standalone component. Import that instead.
 */
@NgModule({
  imports: [DbxActionAnalyticsDirective],
  exports: [DbxActionAnalyticsDirective]
})
export class DbxAnalyticsActionModule {}
