import { DemoOnboardLayoutComponent } from './container/layout.component';
import { DemoOnboardTosComponent } from './container/tos.component';
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoOnboardUserComponent } from './container/user.component';

export const onboardState: Ng2StateDeclaration = {
  url: '/onboard?target',
  name: 'demo.onboard',
  redirectTo: 'demo.onboard.user',
  component: DemoOnboardLayoutComponent
};

export const onboardTosState: Ng2StateDeclaration = {
  name: 'demo.onboard.tos',
  url: '/tos',
  component: DemoOnboardTosComponent
};

export const onboardUserState: Ng2StateDeclaration = {
  name: 'demo.onboard.user',
  url: '/user',
  component: DemoOnboardUserComponent
};

export const DEMO_ONBOARD_STATES: Ng2StateDeclaration[] = [onboardState, onboardTosState, onboardUserState];
