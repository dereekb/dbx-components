import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocRouterAnchorComponent } from './container/anchor.component';
import { DocRouterAnchorListComponent } from './container/anchorlist.component';
import { DocRouterHomeComponent } from './container/home.component';
import { DocRouterLayoutComponent } from './container/layout.component';
import { DocRouterNavbarAComponent } from './container/navbar.a.component';
import { DocRouterNavbarBComponent } from './container/navbar.b.component';
import { DocRouterNavbarComponent } from './container/navbar.component';
import { DocRouterSidenavComponent } from './container/sidenav.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/router',
  name: 'doc.router',
  component: DocRouterLayoutComponent,
  redirectTo: 'doc.router.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.router.home',
  component: DocRouterHomeComponent
};

export const DOC_ROUTER_ANCHOR_STATE: Ng2StateDeclaration = {
  url: '/anchor',
  name: 'doc.router.anchor',
  component: DocRouterAnchorComponent
};

export const DOC_ROUTER_ANCHOR_LIST_STATE: Ng2StateDeclaration = {
  url: '/anchorlist',
  name: 'doc.router.anchorlist',
  component: DocRouterAnchorListComponent
};

export const DOC_ROUTER_NAVBAR_STATE: Ng2StateDeclaration = {
  url: '/navbar',
  name: 'doc.router.navbar',
  component: DocRouterNavbarComponent
};

export const DOC_ROUTER_NAVBAR_A_STATE: Ng2StateDeclaration = {
  url: '/a',
  name: 'doc.router.navbar.a',
  component: DocRouterNavbarAComponent
};

export const DOC_ROUTER_NAVBAR_B_STATE: Ng2StateDeclaration = {
  url: '/b',
  name: 'doc.router.navbar.b',
  component: DocRouterNavbarBComponent
};

export const DOC_ROUTER_SIDENAV_STATE: Ng2StateDeclaration = {
  url: '/sidenav',
  name: 'doc.router.sidenav',
  component: DocRouterSidenavComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  DOC_ROUTER_ANCHOR_STATE,
  DOC_ROUTER_ANCHOR_LIST_STATE,
  DOC_ROUTER_NAVBAR_STATE,
  DOC_ROUTER_NAVBAR_A_STATE,
  DOC_ROUTER_NAVBAR_B_STATE,
  DOC_ROUTER_SIDENAV_STATE
];
