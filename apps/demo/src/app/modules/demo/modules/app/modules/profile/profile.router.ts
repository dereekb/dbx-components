import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoProfileLayoutComponent } from './container/layout.component';
import { DemoProfileViewComponent } from './container/profile.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/profile',
  name: 'demo.app.profile',
  redirectTo: 'demo.app.profile.view',
  component: DemoProfileLayoutComponent
};

export const PROFILE_VIEW_STATE: Ng2StateDeclaration = {
  name: 'demo.app.profile.view',
  url: '/view',
  component: DemoProfileViewComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, PROFILE_VIEW_STATE];
