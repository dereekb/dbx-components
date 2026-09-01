import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoFormSpaceLayoutComponent } from './container/layout.component';
import { DemoFormSpaceListPageComponent } from './container/list.component';
import { DemoFormSpaceListPageRightComponent } from './container/list.right.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/formspace',
  name: 'demo.app.formspace',
  redirectTo: 'demo.app.formspace.list',
  component: DemoFormSpaceLayoutComponent
};

/**
 * Form space list page.
 *
 * @dbxRouteModelList formSpace - The caller's own form spaces
 */
export const FORM_SPACE_LIST_STATE: Ng2StateDeclaration = {
  name: 'demo.app.formspace.list',
  component: DemoFormSpaceListPageComponent
};

export const FORM_SPACE_LIST_RIGHT_STATE: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.formspace.list.formspace',
  component: DemoFormSpaceListPageRightComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, FORM_SPACE_LIST_STATE, FORM_SPACE_LIST_RIGHT_STATE];
