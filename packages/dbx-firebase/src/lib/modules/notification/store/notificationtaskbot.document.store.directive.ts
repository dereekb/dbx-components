import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { NotificationTaskBotDocumentStore } from './notificationtaskbot.document.store';
import { type NotificationTaskBot, type NotificationTaskBotDocument } from '@dereekb/firebase';

/**
 * Directive providing a {@link NotificationTaskBotDocumentStore} for accessing a single notification task bot.
 */
@Directive({
  selector: '[dbxFirebaseNotificationTaskBotDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DbxFirebaseNotificationTaskBotDocumentStoreDirective, NotificationTaskBotDocumentStore)
})
export class DbxFirebaseNotificationTaskBotDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<NotificationTaskBot, NotificationTaskBotDocument, NotificationTaskBotDocumentStore> {
  constructor() {
    super(inject(NotificationTaskBotDocumentStore));
  }
}
