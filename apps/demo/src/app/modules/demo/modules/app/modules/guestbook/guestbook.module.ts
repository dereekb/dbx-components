import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './guestbook.router';
import { DemoAppSharedModule } from '../../../shared/demo.app.shared.module';
import { DemoGuestbookListPageRightComponent } from './container/list.right.component';
import { DemoGuestbookListPageComponent } from './container/list.component';
import { DemoGuestbookLayoutComponent } from './container/layout.component';
import { DemoGuestbookViewComponent } from './container/guestbook.view.component';

@NgModule({
  imports: [
    DemoAppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DemoGuestbookViewComponent,
    DemoGuestbookLayoutComponent,
    DemoGuestbookListPageComponent,
    DemoGuestbookListPageRightComponent
  ],
})
export class DemoGuestbookModule { }
