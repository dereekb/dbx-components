import { Guestbook } from 'demo-firebase';
import { Component } from '@angular/core';
import {
  AbstractDbxSelectionListWrapperDirective,
  AbstractDbxValueListViewItemComponent,
  AbstractDbxSelectionListViewDirective,
  DbxSelectionValueListViewConfig,
  provideDbxListView,
  DbxValueAsListItem,
  provideDbxListViewWrapper,
  DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DbxSelectionValueListViewComponentImportsModule,
  DbxListWrapperComponentImportsModule,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE
} from '@dereekb/dbx-web';
import { of } from 'rxjs';

export type GuestbookWithSelection = DbxValueAsListItem<Guestbook>;

@Component({
  selector: 'demo-guestbook-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListViewWrapper(DemoGuestbookListComponent),
  standalone: true,
  imports: [DbxListWrapperComponentImportsModule]
})
export class DemoGuestbookListComponent extends AbstractDbxSelectionListWrapperDirective<Guestbook> {
  constructor() {
    super({
      componentClass: DemoGuestbookListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'demo-guestbook-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListView(DemoGuestbookListViewComponent),
  standalone: true,
  imports: [DbxSelectionValueListViewComponentImportsModule]
})
export class DemoGuestbookListViewComponent extends AbstractDbxSelectionListViewDirective<Guestbook> {
  readonly config: DbxSelectionValueListViewConfig<GuestbookWithSelection> = {
    componentClass: DemoGuestbookListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div>
      <p>{{ name }}</p>
    </div>
  `,
  standalone: true
})
export class DemoGuestbookListViewItemComponent extends AbstractDbxValueListViewItemComponent<Guestbook> {
  readonly name = this.itemValue.name;
}
