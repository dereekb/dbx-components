import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocBugsLayoutComponent } from './container/layout.component';
import { DocBugsHomeComponent } from './container/home.component';
import { DocBugsFormsComponent } from './container/forms.component';
import { DocBugsCalendarComponent } from './container/calendar.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/bugs',
  name: 'doc.bugs',
  component: DocBugsLayoutComponent,
  redirectTo: 'doc.bugs.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.bugs.home',
  component: DocBugsHomeComponent
};

export const formsState: Ng2StateDeclaration = {
  url: '/forms',
  name: 'doc.bugs.forms',
  component: DocBugsFormsComponent
};

export const calendarState: Ng2StateDeclaration = {
  url: '/calendar',
  name: 'doc.bugs.calendar',
  component: DocBugsCalendarComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  layoutState,
  homeState,
  formsState,
  calendarState
];
