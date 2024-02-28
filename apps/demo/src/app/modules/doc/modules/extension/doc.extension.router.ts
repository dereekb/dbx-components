import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocExtensionLayoutComponent } from './container/layout.component';
import { DocExtensionCalendarComponent } from './container/calendar.component';
import { DocExtensionHomeComponent } from './container/home.component';
import { DocExtensionWidgetComponent } from './container/widget.component';
import { DocExtensionMapboxComponent } from './container/mapbox.component';
import { DocExtensionTableComponent } from './container/table.component';
import { DocExtensionStructureComponent } from './container/structure.component';
import { DocExtensionDownloadComponent } from './container/download.component';

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

export const docExtensionWidgetState: Ng2StateDeclaration = {
  url: '/widget',
  name: 'doc.extension.widget',
  component: DocExtensionWidgetComponent
};

export const docExtensionMapboxState: Ng2StateDeclaration = {
  url: '/mapbox',
  name: 'doc.extension.mapbox',
  component: DocExtensionMapboxComponent
};

export const docExtensionTableState: Ng2StateDeclaration = {
  url: '/table',
  name: 'doc.extension.table',
  component: DocExtensionTableComponent
};

export const docExtensionStructureState: Ng2StateDeclaration = {
  url: '/structure',
  name: 'doc.extension.structure',
  component: DocExtensionStructureComponent
};

export const docExtensionDownloadState: Ng2StateDeclaration = {
  url: '/download',
  name: 'doc.extension.download',
  component: DocExtensionDownloadComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  layoutState,
  homeState,
  docExtensionCalendarState,
  docExtensionWidgetState,
  docExtensionMapboxState,
  docExtensionTableState,
  docExtensionStructureState,
  docExtensionDownloadState
];
