import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocAuthFirebaseComponent } from './container/firebase.component';
import { DocAuthHomeComponent } from './container/home.component';
import { DocAuthLayoutComponent } from './container/layout.component';
import { DocAuthRoleComponent } from './container/role.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/auth',
  name: 'doc.auth',
  component: DocAuthLayoutComponent,
  redirectTo: 'doc.auth.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.auth.home',
  component: DocAuthHomeComponent
};

export const docAuthRoleState: Ng2StateDeclaration = {
  url: '/role',
  name: 'doc.auth.role',
  component: DocAuthRoleComponent
};

export const docAuthFirebaseState: Ng2StateDeclaration = {
  url: '/firebase',
  name: 'doc.auth.firebase',
  component: DocAuthFirebaseComponent
};

export const STATES: Ng2StateDeclaration[] = [layoutState, homeState, docAuthRoleState, docAuthFirebaseState];
