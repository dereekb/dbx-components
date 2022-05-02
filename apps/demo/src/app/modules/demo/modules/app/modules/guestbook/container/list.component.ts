import { GuestbookWithId } from '@dereekb/demo-firebase';
import { Component } from '@angular/core';
import { DemoAppRouterService } from '../../../../shared/services/demo.app.router.service';
import { AnchorForValueFunction } from '@dereekb/dbx-web';

@Component({
  templateUrl: './list.component.html'
})
export class DemoGuestbookListPageComponent {

  readonly guestbookListRef = this.demoAppRouterService.guestbookListRef();
  readonly makeGuestbookAnchor: AnchorForValueFunction<GuestbookWithId> = (doc) => this.demoAppRouterService.guestbookRef(doc.id);

  constructor(readonly demoAppRouterService: DemoAppRouterService) { }

}
