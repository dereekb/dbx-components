import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoCalendarLayoutComponent } from './container/layout.component';
import { DemoCalendarViewComponent } from './container/calendar.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/calendar',
  name: 'demo.app.calendar',
  redirectTo: 'demo.app.calendar.calendar',
  component: DemoCalendarLayoutComponent
};

export const CALENDAR_STATE: Ng2StateDeclaration = {
  name: 'demo.app.calendar.calendar',
  component: DemoCalendarViewComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, CALENDAR_STATE];
