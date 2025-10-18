import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoProfileLayoutComponent } from './container/layout.component';
import { DemoProfileViewComponent } from './container/profile.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/profile',
  name: 'demo.app.profile',
  redirectTo: 'demo.app.profile.view',
  component: DemoProfileLayoutComponent
};

export const profileViewState: Ng2StateDeclaration = {
  name: 'demo.app.profile.view',
  url: '/view',
  component: DemoProfileViewComponent
};

export const STATES: Ng2StateDeclaration[] = [layoutState, profileViewState];
