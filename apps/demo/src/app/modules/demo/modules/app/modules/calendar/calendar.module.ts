import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './calendar.router';

import { DemoCalendarLayoutComponent } from './container/layout.component';
import { DemoCalendarViewComponent } from './container/calendar.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    DemoCalendarLayoutComponent,
    DemoCalendarViewComponent
  ]
})
export class DemoCalendarModule {}
