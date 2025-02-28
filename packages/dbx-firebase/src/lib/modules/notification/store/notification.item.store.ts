import { Injectable, OnDestroy } from '@angular/core';
import { NotificationId, NotificationItem } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';

export interface DbxFirebaseNotificationItemStoreState {
  /**
   * The NotificationSummary to pull items from
   */
  readonly items: NotificationItem[];
  /**
   * The currently selected id
   */
  readonly selectedId: Maybe<NotificationId>;
}

/**
 * Store used for selecting a specific NotificationItem from a list of notification items.
 */
@Injectable()
export class DbxFirebaseNotificationItemStore extends ComponentStore<DbxFirebaseNotificationItemStoreState> implements OnDestroy {
  constructor() {
    super({
      items: [],
      selectedId: undefined
    });
  }

  // MARK: Accessors
  readonly items$ = this.select((state) => state.items);

  readonly selectedId$ = this.select((state) => state.selectedId).pipe(distinctUntilChanged(), shareReplay(1));

  readonly selectedItem$ = combineLatest([this.items$, this.selectedId$]).pipe(
    map(([items, selectedId]) => {
      return items.find((item) => item.id === selectedId);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setItems = this.updater((state, items: NotificationItem[]) => ({ ...state, items }));
  readonly setSelectedId = this.updater((state, selectedId: Maybe<NotificationId>) => ({ ...state, selectedId }));
}
