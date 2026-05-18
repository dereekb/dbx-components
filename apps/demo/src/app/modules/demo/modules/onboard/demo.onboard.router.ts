import { DemoOnboardLayoutComponent } from './container/layout.component';
import { DemoOnboardTosComponent } from './container/tos.component';
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoOnboardUserComponent } from './container/user.component';

export const ONBOARD_STATE: Ng2StateDeclaration = {
  url: '/onboard?target',
  name: 'demo.onboard',
  redirectTo: 'demo.onboard.user',
  component: DemoOnboardLayoutComponent
};

export const ONBOARD_TOS_STATE: Ng2StateDeclaration = {
  name: 'demo.onboard.tos',
  url: '/tos',
  component: DemoOnboardTosComponent
};

export const ONBOARD_USER_STATE: Ng2StateDeclaration = {
  name: 'demo.onboard.user',
  url: '/user',
  component: DemoOnboardUserComponent
};

export const DEMO_ONBOARD_STATES: Ng2StateDeclaration[] = [ONBOARD_STATE, ONBOARD_TOS_STATE, ONBOARD_USER_STATE];
