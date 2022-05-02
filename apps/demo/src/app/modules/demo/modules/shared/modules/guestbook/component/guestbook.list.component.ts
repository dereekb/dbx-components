import { Guestbook } from '@dereekb/demo-firebase';
import { Component } from "@angular/core";
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, ProvideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, ProvideDbxListViewWrapper } from "@dereekb/dbx-web";
import { of } from "rxjs";

export type GuestbookWithSelection = DbxValueAsListItem<Guestbook>;

@Component({
  selector: 'demo-guestbook-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE,
  providers: ProvideDbxListViewWrapper(DemoGuestbookListComponent)
})
export class DemoGuestbookListComponent extends AbstractDbxSelectionListWrapperDirective<Guestbook> {

  constructor() {
    super({
      componentClass: DemoGuestbookListViewComponent,
      defaultSelectionMode: 'view',
    });
  }

}

@Component({
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: ProvideDbxListView(DemoGuestbookListViewComponent)
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
  `
})
export class DemoGuestbookListViewItemComponent extends AbstractDbxValueListViewItemComponent<Guestbook> {

  get name() {
    return this.itemValue.name;
  }

}
