import { Component, Input, OnDestroy } from '@angular/core';
import { DbxWidgetViewComponentConfig } from '@dereekb/dbx-web';
import { NotificationItem, NotificationItemMetadata } from '@dereekb/firebase';
import { filterMaybe } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, Observable, map, shareReplay } from 'rxjs';
import { DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE, dbxWidgetTypeForNotificationTemplateType } from '../service';

@Component({
  selector: 'dbx-firebase-notificationitem-view',
  template: `
    <dbx-widget-view [config]="config$ | async"></dbx-widget-view>
  `
})
export class DbxFirebaseNotificationItemViewComponent<D extends NotificationItemMetadata = {}> implements OnDestroy {
  private readonly _item = new BehaviorSubject<Maybe<NotificationItem<D>>>(undefined);

  readonly config$: Observable<DbxWidgetViewComponentConfig> = this._item.pipe(
    filterMaybe(),
    map((data) => {
      const type = dbxWidgetTypeForNotificationTemplateType(data.t);

      const widgetConfig: DbxWidgetViewComponentConfig = {
        type,
        data,
        defaultType: DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE
      };

      return widgetConfig;
    }),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this._item.complete();
  }

  @Input()
  get item(): Maybe<NotificationItem<D>> {
    return this._item.getValue();
  }

  set item(value: Maybe<NotificationItem<D>>) {
    this._item.next(value);
  }
}
