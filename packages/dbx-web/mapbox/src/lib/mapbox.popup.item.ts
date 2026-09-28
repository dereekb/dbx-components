import { type Signal } from '@angular/core';
import { type DbxInjectionComponentConfigWithoutInjector } from '@dereekb/dbx-core';
import { type Destroyable, type LatLngPointInput, type Maybe } from '@dereekb/util';
import { type DbxMapboxInjectionKey } from './mapbox.injection.store';
import { type DbxMapboxPopupComponentConfig } from './mapbox.popup.component';

/**
 * Default DbxMapboxInjectionStore key used by dbxMapboxItemPopupController().
 */
export const DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEY: DbxMapboxInjectionKey = 'dbxMapboxItemPopup';

/**
 * Default selector for map click targets that keep the item popup open.
 *
 * A click on a marker belongs to the marker (which typically moves the popup to its own item), and a click inside a popup belongs to the popup.
 */
export const DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEEP_OPEN_CLICK_SELECTOR = '.mapboxgl-marker, .mapboxgl-popup';

/**
 * Returns where on the map the popup for the input item is anchored.
 */
export type DbxMapboxItemPopupLatLngFunction<T> = (item: T) => LatLngPointInput;

/**
 * Context provided to the content component of an item popup.
 *
 * Inject it in the content component to read the item and to close the popup.
 */
export abstract class DbxMapboxItemPopupContext<T = unknown> {
  /**
   * The item the popup is showing. Changes when the popup moves to another item.
   */
  abstract readonly item: Signal<T>;
  /**
   * Closes the popup.
   */
  abstract close(): void;
  /**
   * Pans the map so the whole popup is visible. Call it after the content changes size, e.g. after it finishes loading.
   */
  abstract panIntoView(): void;
}

/**
 * dbxMapboxItemPopupController() configuration.
 */
export interface DbxMapboxItemPopupControllerConfig<T> {
  /**
   * DbxMapboxInjectionStore key for the popup. Only one popup per key is open at a time.
   *
   * Defaults to DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEY.
   */
  readonly key?: Maybe<DbxMapboxInjectionKey>;
  /**
   * Returns where on the map the popup for an item is anchored.
   */
  readonly latLng: DbxMapboxItemPopupLatLngFunction<T>;
  /**
   * Component rendered inside the popup. It can inject DbxMapboxItemPopupContext to read the item.
   */
  readonly content: DbxInjectionComponentConfigWithoutInjector;
  /**
   * Display configuration for the popup.
   */
  readonly popup?: Maybe<DbxMapboxPopupComponentConfig>;
  /**
   * Whether to close the popup when the map is clicked away from any marker or popup.
   *
   * Requires a DbxMapboxMapStore. Defaults to true.
   */
  readonly closeOnMapClick?: Maybe<boolean>;
  /**
   * Selector for map click targets that keep the popup open.
   *
   * Defaults to DEFAULT_DBX_MAPBOX_ITEM_POPUP_KEEP_OPEN_CLICK_SELECTOR.
   */
  readonly keepOpenClickSelector?: Maybe<string>;
}

/**
 * Opens a single popup for one item at a time, e.g. the item whose marker was clicked.
 */
export interface DbxMapboxItemPopupController<T> extends Destroyable {
  /**
   * DbxMapboxInjectionStore key the popup is added with.
   */
  readonly key: DbxMapboxInjectionKey;
  /**
   * The item the open popup is showing, if a popup is open.
   */
  readonly item: Signal<Maybe<T>>;
  /**
   * Whether the popup is open.
   */
  readonly isOpen: Signal<boolean>;
  /**
   * Opens the popup for the input item. When the popup is already open it moves to the input item right away, so the user can click from marker to marker.
   *
   * @param item - The item to show.
   */
  open(item: T): void;
  /**
   * Closes the popup, if open.
   */
  close(): void;
}

/**
 * Data passed to DbxMapboxItemPopupComponent through the DbxMapboxInjectionStore. Created by dbxMapboxItemPopupController().
 */
export interface DbxMapboxItemPopupComponentData<T> {
  readonly item: Signal<T>;
  readonly latLng: DbxMapboxItemPopupLatLngFunction<T>;
  readonly content: DbxInjectionComponentConfigWithoutInjector;
  readonly popup?: Maybe<DbxMapboxPopupComponentConfig>;
  /**
   * Closes this popup. Does nothing when the controller has since closed it and opened a new one.
   */
  readonly close: () => void;
}
