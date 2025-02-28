import { Injectable, inject } from '@angular/core';
import { isSameDate } from '@dereekb/date';
import { AbstractDbxFirebaseDocumentStore, firebaseDocumentStoreUpdateFunction } from '../../../model/modules/store';
import { NotificationFirestoreCollections, NotificationFunctions, NotificationItem, NotificationItemMetadata, NotificationSummary, NotificationSummaryDocument, UnreadNotificationItemsResult, unreadNotificationItems } from '@dereekb/firebase';
import { LoadingState, ObservableOrValue, asObservable, mapLoadingStateValueWithOperator } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { map, shareReplay, distinctUntilChanged, Observable, combineLatest } from 'rxjs';

@Injectable()
export class NotificationSummaryDocumentStore extends AbstractDbxFirebaseDocumentStore<NotificationSummary, NotificationSummaryDocument> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ firestoreCollection: inject(NotificationFirestoreCollections).notificationSummaryCollection });
  }

  readonly notificationItemsLoadingState$: Observable<LoadingState<NotificationItem<any>[]>> = this.dataLoadingState$.pipe(
    mapLoadingStateValueWithOperator(map((x) => [...x.n].reverse())), // n is sorted in ascending order
    shareReplay(1)
  );

  readonly createdAt$ = this.data$.pipe(
    map((x) => x.cat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly lastReadAt$ = this.data$.pipe(
    map((x) => x.rat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly lastUpdateAt$ = this.data$.pipe(
    map((x) => x.lat),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly notificationItems$ = this.data$.pipe(
    map((x) => [...x.n].reverse()), // n is sorted in ascending order
    shareReplay(1)
  );

  readonly needsSync$ = this.data$.pipe(
    map((x) => x.s),
    distinctUntilChanged(),
    shareReplay(1)
  );

  notificationItemsLoadingState<D extends NotificationItemMetadata = {}>(): Observable<LoadingState<NotificationItem<D>[]>> {
    return this.notificationItemsLoadingState$;
  }

  unreadNotificationItems<D extends NotificationItemMetadata = {}>(checkLastReadIfCreatedBeforeObs?: ObservableOrValue<Maybe<Date>>): Observable<UnreadNotificationItemsResult<D>> {
    return combineLatest([asObservable(checkLastReadIfCreatedBeforeObs), this.notificationItems$ as Observable<NotificationItem<D>[]>]).pipe(map(([c, items]) => unreadNotificationItems<D>(items, c)));
  }

  readonly updateNotificationSummary = firebaseDocumentStoreUpdateFunction(this, this.notificationFunctions.notificationSummary.updateNotificationSummary.update);
}
