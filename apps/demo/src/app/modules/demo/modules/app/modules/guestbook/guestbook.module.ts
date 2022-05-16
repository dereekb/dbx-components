import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './guestbook.router';
import { DemoAppSharedModule } from '@dereekb/demo-components';
import { DemoGuestbookListPageRightComponent } from './container/list.right.component';
import { DemoGuestbookListPageComponent } from './container/list.component';
import { DemoGuestbookLayoutComponent } from './container/layout.component';
import { DemoGuestbookViewComponent } from './container/guestbook.view.component';
import { DemoGuestbookEntryPopupComponent } from './container/guestbook.entry.popup.component';

@NgModule({
  imports: [
    DemoAppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DemoGuestbookEntryPopupComponent,
    DemoGuestbookViewComponent,
    DemoGuestbookLayoutComponent,
    DemoGuestbookListPageComponent,
    DemoGuestbookListPageRightComponent
  ],
})
export class DemoGuestbookModule { }
