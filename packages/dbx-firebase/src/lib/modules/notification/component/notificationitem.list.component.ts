import { Component, inject } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE, DbxValueAsListItem, provideDbxListViewWrapper } from '@dereekb/dbx-web';
import { NotificationItem } from '@dereekb/firebase';
import { cachedGetter } from '@dereekb/util';
import { of } from 'rxjs';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';

export type NotificationItemWithSelection = DbxValueAsListItem<NotificationItem>;

@Component({
  selector: 'dbx-firebase-notificationitem-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxFirebaseNotificationItemListComponent)
})
export class DbxFirebaseNotificationItemListComponent extends AbstractDbxSelectionListWrapperDirective<NotificationItem> {
  constructor() {
    super({
      componentClass: DbxFirebaseNotificationItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'dbx-firebase-notificationitem-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_DIRECTIVE_TEMPLATE,
  providers: provideDbxListView(DbxFirebaseNotificationItemListViewComponent)
})
export class DbxFirebaseNotificationItemListViewComponent extends AbstractDbxSelectionListViewDirective<NotificationItem> {
  readonly config: DbxSelectionValueListViewConfig<NotificationItemWithSelection> = {
    componentClass: DbxFirebaseNotificationItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div>
      <p>{{ title }}</p>
      <p>{{ message }}</p>
    </div>
  `
})
export class DbxFirebaseNotificationItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<NotificationItem> {
  readonly dbxFirebaseNotificationTemplateService = inject(DbxFirebaseNotificationTemplateService);

  readonly pairGetter = cachedGetter(() => this.dbxFirebaseNotificationTemplateService.notificationItemSubjectMessagePairForNotificationSummaryItem(this.itemValue));

  get title() {
    return this.pairGetter().title;
  }

  get message() {
    return this.pairGetter().message;
  }
}
