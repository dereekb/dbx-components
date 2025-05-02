import { Guestbook } from 'demo-firebase';
import { Component } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DbxListComponent } from '@dereekb/dbx-web';
import { DbxSelectionValueListViewComponent } from '@dereekb/dbx-web';

export type GuestbookWithSelection = DbxValueAsListItem<Guestbook>;

@Component({
  selector: 'demo-guestbook-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE,
  providers: provideDbxListViewWrapper(DemoGuestbookListComponent),
  standalone: true,
  imports: [DbxListComponent]
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
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DemoGuestbookListViewComponent),
  standalone: true,
  imports: [DbxSelectionValueListViewComponent]
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
