import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocRouterAnchorComponent } from './container/anchor.component';
import { DocRouterAnchorListComponent } from './container/anchorlist.component';
import { DocRouterHomeComponent } from './container/home.component';
import { DocRouterLayoutComponent } from './container/layout.component';
import { DocRouterNavbarComponent } from './container/navbar.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/router',
  name: 'doc.router',
  component: DocRouterLayoutComponent,
  redirectTo: 'doc.router.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.router.home',
  component: DocRouterHomeComponent,
};

export const docRouterAnchorState: Ng2StateDeclaration = {
  url: '/anchor',
  name: 'doc.router.anchor',
  component: DocRouterAnchorComponent,
};

export const docRouterAnchorListState: Ng2StateDeclaration = {
  url: '/anchorlist',
  name: 'doc.router.anchorlist',
  component: DocRouterAnchorListComponent,
};

export const docRouterNavbarState: Ng2StateDeclaration = {
  url: '/navbar',
  name: 'doc.router.navbar',
  component: DocRouterNavbarComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  docRouterAnchorState,
  docRouterAnchorListState,
  docRouterNavbarState
];
