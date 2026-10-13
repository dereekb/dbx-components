import { Injectable, inject } from '@angular/core';
import { isSameDate } from '@dereekb/date';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreReadFunction, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import {
  NotificationFirestoreCollections,
  NotificationFunctions,
  type NotificationTaskBot,
  type NotificationTaskBotDocument,
  type NotificationTaskBotEmbeddedScriptEntry,
  type NotificationTaskBotEntryId,
  type NotificationTaskBotEntryStatus,
  notificationTaskBotEntry,
  notificationTaskBotEntryStatus
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { map, shareReplay, distinctUntilChanged, type Observable } from 'rxjs';

/**
 * Document store for a single NotificationTaskBot, providing derived observables for its script entries and the entry update/run functions.
 */
@Injectable()
export class NotificationTaskBotDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationTaskBot, NotificationTaskBotDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationTaskBotCollection });
  }

  readonly entries$: Observable<NotificationTaskBotEmbeddedScriptEntry[]> = this.data$.pipe(
    map((x) => x.e),
    shareReplay(1)
  );

  readonly nextRunAt$: Observable<Maybe<Date>> = this.data$.pipe(
    map((x) => x.nat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  /**
   * The bot's `stl`: when its earliest stalled entry was marked stalled, or undefined when no entry is stalled.
   */
  readonly stalledAt$: Observable<Maybe<Date>> = this.data$.pipe(
    map((x) => x.stl),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  /**
   * Whether any entry's live run is stalled.
   */
  readonly stalled$: Observable<boolean> = this.stalledAt$.pipe(
    map((x) => x != null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Returns an observable of the entry with the given id.
   *
   * @param entryId - The entry id.
   * @returns An observable of the entry, or undefined when the bot has no such entry.
   */
  entry$(entryId: NotificationTaskBotEntryId): Observable<Maybe<NotificationTaskBotEmbeddedScriptEntry>> {
    return this.data$.pipe(
      map((x) => notificationTaskBotEntry(x, entryId)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  /**
   * Returns an observable of the computed status of the entry with the given id, including `stalled`.
   *
   * @param entryId - The entry id.
   * @returns An observable of the entry's status, or undefined when the bot has no such entry.
   */
  entryStatus$(entryId: NotificationTaskBotEntryId): Observable<Maybe<NotificationTaskBotEntryStatus>> {
    return this.entry$(entryId).pipe(
      map((x) => (x ? notificationTaskBotEntryStatus(x) : undefined)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  readonly updateEntry = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationTaskBot.updateNotificationTaskBot.entry);
  readonly runEntry = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationTaskBot.updateNotificationTaskBot.run);

  /**
   * Reads the owner opt-outs. Admins may read them, but only the bot's owner can change them.
   */
  readonly readOptOuts = firebaseDocumentStoreReadFunction(this, this.notificationFunctions.notificationTaskBot.readNotificationTaskBot.optOuts);

  /**
   * Changes the owner opt-outs. Refused for anyone but the bot's owner, admins included.
   */
  readonly updateOptOut = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationTaskBot.updateNotificationTaskBot.optOut);
}
