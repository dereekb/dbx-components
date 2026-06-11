import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoGuestbookLayoutComponent } from './container/layout.component';
import { DemoGuestbookListPageComponent } from './container/list.component';
import { DemoGuestbookListPageRightComponent } from './container/list.right.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/guestbook',
  name: 'demo.app.guestbook',
  redirectTo: 'demo.app.guestbook.list',
  component: DemoGuestbookLayoutComponent
};

/**
 * Guestbook list page.
 *
 * @dbxRouteModelList guestbook - The published guestbooks shown in the list
 */
export const GUESTBOOK_LIST_STATE: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.list',
  component: DemoGuestbookListPageComponent
};

export const GUESTBOOK_LIST_RIGHT_STATE: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.guestbook.list.guestbook',
  component: DemoGuestbookListPageRightComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, GUESTBOOK_LIST_STATE, GUESTBOOK_LIST_RIGHT_STATE];
