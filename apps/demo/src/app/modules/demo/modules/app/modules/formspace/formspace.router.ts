import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoFormSpaceLayoutComponent } from './container/layout.component';
import { DemoFormSpaceViewComponent } from './container/formspace.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/formspace',
  name: 'demo.app.formspace',
  redirectTo: 'demo.app.formspace.view',
  component: DemoFormSpaceLayoutComponent
};

export const FORM_SPACE_VIEW_STATE: Ng2StateDeclaration = {
  name: 'demo.app.formspace.view',
  component: DemoFormSpaceViewComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, FORM_SPACE_VIEW_STATE];
