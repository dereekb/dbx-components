import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, AbstractDbxSelectionListViewDirective, DbxSelectionValueListViewConfig, provideDbxListView, DbxValueAsListItem, provideDbxListViewWrapper, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule } from '@dereekb/dbx-web';
import { NotificationItem } from '@dereekb/firebase';
import { cachedGetter } from '@dereekb/util';
import { of } from 'rxjs';
import { DbxFirebaseNotificationTemplateService } from '../service/notification.template.service';
import { DatePipe } from '@angular/common';
import { CutTextPipe } from '@dereekb/dbx-core';

export type NotificationItemWithSelection = DbxValueAsListItem<NotificationItem>;

@Component({
  selector: 'dbx-firebase-notificationitem-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListViewWrapper(DbxFirebaseNotificationItemListComponent),
  standalone: true
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
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListView(DbxFirebaseNotificationItemListViewComponent),
  standalone: true
})
export class DbxFirebaseNotificationItemListViewComponent extends AbstractDbxSelectionListViewDirective<NotificationItem> {
  readonly config: DbxSelectionValueListViewConfig<NotificationItemWithSelection> = {
    componentClass: DbxFirebaseNotificationItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item dbx-firebase-notificationitem-list-view-item">
      <div class="item-left">
        <span class="notificationitem-subject">{{ subject }}</span>
        <span class="notificationitem-message item-details">{{ message | cutText: 90 }}</span>
        <span class="notificationitem-date item-details-footnote">{{ date | date: 'medium' }}</span>
      </div>
    </div>
  `,
  imports: [DatePipe, CutTextPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseNotificationItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<NotificationItem> {
  readonly dbxFirebaseNotificationTemplateService = inject(DbxFirebaseNotificationTemplateService);
  readonly pairGetter = cachedGetter(() => this.dbxFirebaseNotificationTemplateService.notificationItemSubjectMessagePairForNotificationSummaryItem(this.itemValue));

  get subject() {
    return this.pairGetter().subject;
  }

  get message() {
    return this.pairGetter().message;
  }

  get date() {
    return this.pairGetter().date;
  }
}
