import { computed, inject, signal, type WritableSignal } from '@angular/core';
import { clean } from '@dereekb/dbx-core';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { filter, skip } from 'rxjs';
import { DbxMapboxInjectionStore } from './mapbox.injection.store';
import { DbxMapboxMapStore } from './mapbox.store';
import { type DbxMapboxItemPopupComponentData, type DbxMapboxItemPopupController, type DbxMapboxItemPopupControllerConfig, DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEEP_OPEN_CLICK_SELECTOR, DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEY } from './mapbox.popup.item';
import { DbxMapboxItemPopupComponent } from './mapbox.popup.item.component';

/**
 * Creates a DbxMapboxItemPopupController that shows one item at a time in a popup on the map, e.g. the item whose marker was clicked.
 *
 * The popup is added through the DbxMapboxInjectionStore, so the map must render a dbx-mapbox-injection. Opening another item while the popup is open moves the same popup to that item instead of closing and reopening it. By default the popup closes when the map is clicked away from any marker or popup.
 *
 * Must be run within an Angular injection context. The popup is closed when the context is destroyed.
 *
 * @param config - Which content to show and where to anchor it.
 * @returns The controller.
 *
 * @example
 * ```ts
 * readonly placePopup = dbxMapboxItemPopupController<Place>({
 *   latLng: (place) => place.latLng,
 *   content: { componentClass: PlacePopupContentComponent }
 * });
 *
 * readonly markerFactory: DbxMapboxMarkerFactory<Place> = (place) => ({
 *   latLng: place.latLng,
 *   label: place.name,
 *   anchor: { onClick: () => this.placePopup.open(place) }
 * });
 * ```
 */
export function dbxMapboxItemPopupController<T>(config: DbxMapboxItemPopupControllerConfig<T>): DbxMapboxItemPopupController<T> {
  const { latLng, content, popup } = config;
  const key = config.key ?? DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEY;
  const closeOnMapClick = config.closeOnMapClick ?? true;
  const keepOpenClickSelector = config.keepOpenClickSelector ?? DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEEP_OPEN_CLICK_SELECTOR;

  const dbxMapboxInjectionStore = inject(DbxMapboxInjectionStore);
  const dbxMapboxMapStore = inject(DbxMapboxMapStore, { optional: true });

  const itemSignal = signal<Maybe<T>>(undefined);
  const isOpenSignal = computed(() => itemSignal() != null);

  /**
   * Item signal of the open popup. Each opened popup gets its own signal so a popup that is closing never sees the item go away.
   */
  let openPopupItem: Maybe<WritableSignal<T>>;

  function close() {
    if (openPopupItem) {
      openPopupItem = undefined;
      itemSignal.set(undefined);
      dbxMapboxInjectionStore.removeInjectionConfigWithKey(key);
    }
  }

  function open(item: T) {
    itemSignal.set(item);

    if (openPopupItem) {
      openPopupItem.set(item);
    } else {
      const popupItem = signal(item);
      openPopupItem = popupItem;

      const data: DbxMapboxItemPopupComponentData<T> = {
        item: popupItem.asReadonly(),
        latLng,
        content,
        popup,
        close: () => {
          // mapbox-gl reports a removed popup as closed after a delay, by which time a new popup may be open
          if (openPopupItem === popupItem) {
            close();
          }
        }
      };

      dbxMapboxInjectionStore.addInjectionConfig({
        key,
        injectionConfig: {
          componentClass: DbxMapboxItemPopupComponent,
          data
        }
      });
    }
  }

  const mapClickSub = new SubscriptionObject();

  if (closeOnMapClick && dbxMapboxMapStore) {
    mapClickSub.subscription = dbxMapboxMapStore.clickEvent$
      .pipe(
        skip(1), // the store replays its last click
        filterMaybe(),
        filter((x) => !(x.originalEvent?.target as Maybe<Element>)?.closest?.(keepOpenClickSelector))
      )
      .subscribe(() => close());
  }

  const controller: DbxMapboxItemPopupController<T> = {
    key,
    item: itemSignal.asReadonly(),
    isOpen: isOpenSignal,
    open,
    close,
    destroy: () => {
      mapClickSub.destroy();
      close();
    }
  };

  clean(controller);
  return controller;
}
