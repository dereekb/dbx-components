import { GuestbookEntry } from '@dereekb/demo-firebase';
import { Component } from "@angular/core";
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper } from "@dereekb/dbx-web";
import { of } from "rxjs";

export type GuestbookEntryWithSelection = DbxValueAsListItem<GuestbookEntry>;

@Component({
  selector: 'demo-guestbook-entry-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE,
  providers: provideDbxListViewWrapper(DemoGuestbookEntryListComponent)
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
  providers: provideDbxListView(DemoGuestbookEntryListViewComponent)
})
export class DemoGuestbookEntryListViewComponent extends AbstractDbxSelectionListViewDirective<GuestbookEntry> {

  readonly config: DbxSelectionValueListViewConfig<GuestbookEntryWithSelection> = {
    componentClass: DemoGuestbookEntryListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };

}

@Component({
  template: `
    <div class="demo-guestbook-entry-list-item">
      <p class="item-message">"{{ message }}"</p>
      <p class="item-signed">
        <span class="signed-prefix">--</span>
        <span class="signed-by">{{ signed }}</span>
        <span class="item-updated">{{ updatedAt | toJsDate | date:'medium' }}</span>
      </p>
    </div>
  `,
  styleUrls: ['./guestbook.scss']
})
export class DemoGuestbookEntryListViewItemComponent extends AbstractDbxValueListViewItemComponent<GuestbookEntry> {

  get updatedAt() {
    return this.itemValue.updatedAt;
  }

  get message() {
    return this.itemValue.message;
  }

  get signed() {
    return this.itemValue.signed;
  }

}
