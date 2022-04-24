import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocLayoutBarComponent } from './container/bar.component';
import { DocLayoutContentComponent } from './container/content.component';
import { DocLayoutFlexComponent } from './container/flex.component';
import { DocLayoutHomeComponent } from './container/home.component';
import { DocLayoutLayoutComponent } from './container/layout.component';
import { DocLayoutListComponent } from './container/list.component';
import { DocLayoutSectionComponent } from './container/section.component';
import { DocLayoutTwoColumnsComponent } from './container/two.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout',
  component: DocLayoutLayoutComponent,
  redirectTo: 'doc.layout.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.layout.home',
  component: DocLayoutHomeComponent,
};

export const docLayoutBarState: Ng2StateDeclaration = {
  url: '/bar',
  name: 'doc.layout.bar',
  component: DocLayoutBarComponent,
};

export const docLayoutContentState: Ng2StateDeclaration = {
  url: '/content',
  name: 'doc.layout.content',
  component: DocLayoutContentComponent
};

export const docLayoutFlexState: Ng2StateDeclaration = {
  url: '/flex',
  name: 'doc.layout.flex',
  component: DocLayoutFlexComponent
};

export const docLayoutSectionState: Ng2StateDeclaration = {
  url: '/section',
  name: 'doc.layout.section',
  component: DocLayoutSectionComponent,
};

export const docLayoutListState: Ng2StateDeclaration = {
  url: '/list',
  name: 'doc.layout.list',
  component: DocLayoutListComponent,
};

export const docLayoutTwoState: Ng2StateDeclaration = {
  url: '/two',
  name: 'doc.layout.two',
  component: DocLayoutTwoColumnsComponent
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  docLayoutBarState,
  docLayoutContentState,
  docLayoutFlexState,
  docLayoutSectionState,
  docLayoutListState,
  docLayoutTwoState
];
