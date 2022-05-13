import { Ng2StateDeclaration } from '@uirouter/angular';
import { DemoGuestbookLayoutComponent } from './container/layout.component';
import { DemoGuestbookListPageComponent } from './container/list.component';
import { DemoGuestbookListPageRightComponent } from './container/list.right.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/guestbook',
  name: 'demo.app.guestbook',
  redirectTo: 'demo.app.guestbook.list',
  component: DemoGuestbookLayoutComponent
};

export const guestbookListState: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.list',
  component: DemoGuestbookListPageComponent
};

export const guestbookListRightState: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.guestbook.list.guestbook',
  component: DemoGuestbookListPageRightComponent
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  guestbookListState,
  guestbookListRightState
];
