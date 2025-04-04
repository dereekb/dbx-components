import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DbxWidgetViewComponentConfig, DbxWidgetViewComponent } from '@dereekb/dbx-web';
import { NotificationItem, NotificationItemMetadata } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE, dbxWidgetTypeForNotificationTemplateType } from '../service';

@Component({
  selector: 'dbx-firebase-notificationitem-view',
  template: `
    <dbx-widget-view [config]="configSignal()"></dbx-widget-view>
  `,
  standalone: true,
  imports: [DbxWidgetViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationItemViewComponent<D extends NotificationItemMetadata = {}> {
  readonly item = input<Maybe<NotificationItem<D>>>();

  readonly configSignal = computed(() => {
    const data = this.item();

    let config: Maybe<DbxWidgetViewComponentConfig> = undefined;

    if (data) {
      const type = dbxWidgetTypeForNotificationTemplateType(data.t);

      config = {
        type,
        data,
        defaultType: DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE
      };
    }

    return config;
  });
}
