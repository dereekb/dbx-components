import { Directive, inject } from '@angular/core';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from '../../../model/modules/store';
import { NotificationTaskBotCollectionStore } from './notificationtaskbot.collection.store';
import { type NotificationTaskBot, type NotificationTaskBotDocument } from '@dereekb/firebase';

/**
 * Directive providing a {@link NotificationTaskBotCollectionStore} for querying notification task bots.
 */
@Directive({
  selector: '[dbxFirebaseNotificationTaskBotCollection]',
  providers: provideDbxFirebaseCollectionStoreDirective(DbxFirebaseNotificationTaskBotCollectionStoreDirective, NotificationTaskBotCollectionStore)
})
export class DbxFirebaseNotificationTaskBotCollectionStoreDirective extends DbxFirebaseCollectionStoreDirective<NotificationTaskBot, NotificationTaskBotDocument, NotificationTaskBotCollectionStore> {
  constructor() {
    super(inject(NotificationTaskBotCollectionStore));
  }
}
