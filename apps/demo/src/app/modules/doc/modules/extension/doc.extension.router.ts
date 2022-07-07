import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocExtensionLayoutComponent } from './container/layout.component';
import { DocExtensionCalendarComponent } from './container/calendar.component';
import { DocExtensionHomeComponent } from './container/home.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/extension',
  name: 'doc.extension',
  component: DocExtensionLayoutComponent,
  redirectTo: 'doc.extension.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.extension.home',
  component: DocExtensionHomeComponent
};

export const docExtensionCalendarState: Ng2StateDeclaration = {
  url: '/calendar',
  name: 'doc.extension.calendar',
  component: DocExtensionCalendarComponent
};

export const STATES: Ng2StateDeclaration[] = [layoutState, homeState, docExtensionCalendarState];
