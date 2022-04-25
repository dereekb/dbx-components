import { GuestbookEntry } from '@dereekb/demo-firebase';
import { Component } from "@angular/core";
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, ProvideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem } from "@dereekb/dbx-web";
import { of } from "rxjs";

export type GuestbookEntryWithSelection = DbxValueAsListItem<GuestbookEntry>;

@Component({
  selector: 'demo-guestbook-entry-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DemoGuestbookEntryListComponent extends AbstractDbxSelectionListWrapperDirective<GuestbookEntry> {

  constructor() {
    super({
      componentClass: DemoGuestbookEntryListViewComponent,
      defaultSelectionMode: 'view'
    });
  }

}

@Component({
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: ProvideDbxListView(DemoGuestbookEntryListViewComponent)
})
export class DemoGuestbookEntryListViewComponent extends AbstractDbxSelectionListViewDirective<GuestbookEntry> {

  readonly config: DbxSelectionValueListViewConfig<GuestbookEntryWithSelection> = {
    componentClass: DemoGuestbookEntryListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };

}

@Component({
  template: `
    <div>
      <p>GuestbookEntry</p>
    </div>
  `
})
export class DemoGuestbookEntryListViewItemComponent extends AbstractDbxValueListViewItemComponent<GuestbookEntry> { }
