import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocLayoutBarComponent } from './container/bar.component';
import { DocLayoutContentComponent } from './container/content.component';
import { DocLayoutHomeComponent } from './container/home.component';
import { DocLayoutLayoutComponent } from './container/layout.component';
import { DocLayoutSectionComponent } from './container/section.component';

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
  component: DocLayoutContentComponent,
};

export const docLayoutSectionState: Ng2StateDeclaration = {
  url: '/section',
  name: 'doc.layout.section',
  component: DocLayoutSectionComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  docLayoutBarState,
  docLayoutContentState,
  docLayoutSectionState
];
