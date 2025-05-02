import { AnchorForValueFunction, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { GuestbookWithId } from 'demo-firebase';
import { Component, inject } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DemoGuestbookCollectionStoreDirective, DemoGuestbookDocumentStoreDirective, DemoGuestbookListComponent } from 'demo-components';
import { DbxFirebaseCollectionListDirective, DbxFirebaseModelViewedEventDirective } from '@dereekb/dbx-firebase';
import { DbxRouteModelIdDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, DbxTwoColumnLayoutModule, DemoGuestbookCollectionStoreDirective, DemoGuestbookListComponent, DbxFirebaseCollectionListDirective, DbxListModifierModule, DemoGuestbookDocumentStoreDirective, DbxRouteModelIdDirective, DbxFirebaseModelViewedEventDirective, DbxListItemAnchorModifierDirective],
  standalone: true
})
export class DemoGuestbookListPageComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);

  readonly guestbookListRef = this.demoAppRouterService.guestbookListRef();
  readonly makeGuestbookAnchor: AnchorForValueFunction<GuestbookWithId> = (doc) => this.demoAppRouterService.guestbookRef(doc.id);
}
