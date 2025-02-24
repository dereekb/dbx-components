import { Inject, Injectable, inject } from '@angular/core';
import { AppNotificationTemplateTypeInfoRecordService, NotificationItem, NotificationItemMetadata, NotificationItemSubjectMessagePair } from '@dereekb/firebase';

/**
 * Client-side service used for retrieving notification templates.
 */
@Injectable()
export class DbxFirebaseNotificationTemplateService {
  readonly appNotificationTemplateTypeInfoRecordService = inject(AppNotificationTemplateTypeInfoRecordService);

  notificationItemSubjectMessagePairForNotificationSummaryItem<D extends NotificationItemMetadata = {}>(item: NotificationItem<D>): NotificationItemSubjectMessagePair<D> {
    const templateType = item.t;
    const templateDetails = this.appNotificationTemplateTypeInfoRecordService.appNotificationTemplateTypeInfoRecord[templateType];

    const title = item.s ?? templateDetails.name;
    const message = item.g ?? '';

    return {
      item,
      title,
      message
    };
  }
}
