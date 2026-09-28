import { ChangeDetectionStrategy, Component, type ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { latLngPointFunction, type LatLngPointInput, type Maybe, type Pixels } from '@dereekb/util';
import { type Anchor, type LngLatLike, type Map as MapboxMap } from 'mapbox-gl';
import { MapService, PopupComponent } from 'ngx-mapbox-gl';
import { DbxResizedDirective, type ResizedEvent } from '@dereekb/dbx-web';
import { DEFAULT_DBX_MAPBOX_POPUP_OFFSET, DEFAULT_DBX_MAPBOX_POPUP_VIEW_PADDING, type DbxMapboxPopupMaxWidth, type DbxMapboxPopupOffset, mapboxPopupPanIntoViewOffset, mapboxVisibleElementScreenRect } from './mapbox.popup';

/**
 * CSS class added to every popup rendered by DbxMapboxPopupComponent.
 */
export const DBX_MAPBOX_POPUP_CSS_CLASS = 'dbx-mapbox-popup';

/**
 * Display configuration for a DbxMapboxPopupComponent.
 */
export interface DbxMapboxPopupComponentConfig {
  /**
   * Offset from the anchor point. Defaults to DEFAULT_DBX_MAPBOX_POPUP_OFFSET.
   */
  readonly offset?: Maybe<DbxMapboxPopupOffset>;
  /**
   * Fixed side of the anchor point to open on. When unset mapbox-gl picks the side that fits in the map.
   */
  readonly anchor?: Maybe<Anchor>;
  /**
   * Additional CSS classes to add to the popup element.
   */
  readonly popupClass?: Maybe<string>;
  /**
   * Max width of the popup. Defaults to 'none', so the width comes from the content and the dbx-mapbox-popup styles.
   */
  readonly maxWidth?: Maybe<DbxMapboxPopupMaxWidth>;
  /**
   * Whether to pan the map so the whole popup is visible each time it opens or moves. Defaults to true.
   */
  readonly autoPanIntoView?: Maybe<boolean>;
  /**
   * Space to keep between the popup and the edge of the visible map when panning. Defaults to DEFAULT_DBX_MAPBOX_POPUP_VIEW_PADDING.
   */
  readonly panIntoViewPadding?: Maybe<Pixels>;
}

/**
 * Popup anchored to a point on the map. Renders the projected content in a mapbox-gl popup.
 *
 * The popup adds no surface of its own: the content provides it, typically a mat-card. The popup's tail takes the mat-card surface color. It has no close button and does not close when the map is clicked, so the owner decides when it closes; a dbx-dialog-content-close placed in the content floats in its top-right corner.
 *
 * When it opens, moves to another point, or its content changes size, the map pans so the whole popup is visible, measured against the part of the map the user can actually see.
 *
 * Must be placed within a mgl-map, e.g. through the DbxMapboxInjectionStore. Use dbxMapboxItemPopupController() to open a popup for a clicked marker.
 *
 * @dbxWebComponent
 * @dbxWebSlug mapbox-popup
 * @dbxWebCategory overlay
 * @dbxWebRelated popover, dialog-content
 * @dbxWebMinimalExample ```html
 * <dbx-mapbox-popup [latLng]="latLng">Content</dbx-mapbox-popup>
 * ```
 *
 * @example
 * ```html
 * <mgl-map dbxMapboxMap>
 *   <dbx-mapbox-popup [latLng]="place.latLng" popupClass="my-place-popup" (popupClose)="closePlace()">
 *     <mat-card>
 *       <dbx-dialog-content-close [padded]="false" (close)="closePlace()"></dbx-dialog-content-close>
 *       <mat-card-header>
 *         <mat-card-title>{{ place.name }}</mat-card-title>
 *       </mat-card-header>
 *       <mat-card-content>{{ place.description }}</mat-card-content>
 *     </mat-card>
 *   </dbx-mapbox-popup>
 * </mgl-map>
 * ```
 */
@Component({
  selector: 'dbx-mapbox-popup',
  template: `
    <mgl-popup [lngLat]="lngLatSignal()" [offset]="offsetSignal()" [anchor]="anchorSignal()" [closeButton]="false" [closeOnClick]="false" [focusAfterOpen]="false" [maxWidth]="maxWidthSignal()" [className]="classNameSignal()" (popupClose)="popupClose.emit()">
      <div #content class="dbx-mapbox-popup-content" (dbxResized)="onContentResized($event)">
        <ng-content></ng-content>
      </div>
    </mgl-popup>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PopupComponent, DbxResizedDirective]
})
export class DbxMapboxPopupComponent {
  private static readonly _latLngPoint = latLngPointFunction({ wrap: true });

  private readonly _mapService = inject(MapService);
  private readonly _injector = inject(Injector);

  /**
   * Point the popup is anchored to.
   */
  readonly latLng = input.required<LatLngPointInput>();

  readonly config = input<Maybe<DbxMapboxPopupComponentConfig>>();
  readonly offset = input<Maybe<DbxMapboxPopupOffset>>();
  readonly anchor = input<Maybe<Anchor>>();
  readonly popupClass = input<Maybe<string>>();
  readonly maxWidth = input<Maybe<DbxMapboxPopupMaxWidth>>();
  readonly autoPanIntoView = input<Maybe<boolean>>();
  readonly panIntoViewPadding = input<Maybe<Pixels>>();

  /**
   * Emitted when mapbox-gl closes the popup.
   */
  readonly popupClose = output<void>();

  readonly contentElement = viewChild.required<ElementRef<HTMLElement>>('content');

  readonly lngLatSignal = computed<LngLatLike>(() => {
    const { lat, lng } = DbxMapboxPopupComponent._latLngPoint(this.latLng());
    return [lng, lat];
  });

  readonly offsetSignal = computed(() => {
    const offset = this.offset();
    const config = this.config();
    return offset ?? config?.offset ?? DEFAULT_DBX_MAPBOX_POPUP_OFFSET;
  });

  readonly anchorSignal = computed(() => {
    const anchor = this.anchor();
    const config = this.config();
    return anchor ?? config?.anchor ?? undefined;
  });

  readonly maxWidthSignal = computed(() => {
    const maxWidth = this.maxWidth();
    const config = this.config();
    return maxWidth ?? config?.maxWidth ?? 'none';
  });

  readonly autoPanIntoViewSignal = computed(() => {
    const autoPanIntoView = this.autoPanIntoView();
    const config = this.config();
    return autoPanIntoView ?? config?.autoPanIntoView ?? true;
  });

  readonly panIntoViewPaddingSignal = computed(() => {
    const panIntoViewPadding = this.panIntoViewPadding();
    const config = this.config();
    return panIntoViewPadding ?? config?.panIntoViewPadding ?? DEFAULT_DBX_MAPBOX_POPUP_VIEW_PADDING;
  });

  readonly classNameSignal = computed(() => {
    const popupClassInput = this.popupClass();
    const config = this.config();
    const popupClass = popupClassInput ?? config?.popupClass;
    return popupClass ? `${DBX_MAPBOX_POPUP_CSS_CLASS} ${popupClass}` : DBX_MAPBOX_POPUP_CSS_CLASS;
  });

  constructor() {
    // each time the popup opens or moves to another point, pan the map if any part of the popup landed outside the visible map
    effect(() => {
      this.lngLatSignal();

      if (this.autoPanIntoViewSignal()) {
        // mapbox-gl places the popup as soon as it is added or moved, so it can be measured right after the render
        afterNextRender(() => this.panIntoView(), { injector: this._injector });
      }
    });
  }

  /**
   * Re-checks the popup's position when its content changes size, e.g. when an image or async content finishes loading.
   *
   * @param event - The resize of the popup's content.
   */
  onContentResized(event: ResizedEvent): void {
    if (!event.isFirst && this.autoPanIntoViewSignal()) {
      this.panIntoView();
    }
  }

  /**
   * Pans the map so the whole popup is visible.
   *
   * mapbox-gl already picks the side of the anchor point with the most room, but it only knows the size of the map element. The part of the map the user sees can be smaller: clipped by its container, the window, or a drawer.
   *
   * Runs automatically when the popup opens, moves, or its content changes size.
   */
  panIntoView(): void {
    const content = this.contentElement().nativeElement;
    const popupElement = content.closest('.mapboxgl-popup');
    const mapElement = content.closest('.mapboxgl-map');
    const mapInstance: Maybe<MapboxMap> = this._mapService.mapInstance;

    if (popupElement && mapElement && mapInstance) {
      const [x, y] = mapboxPopupPanIntoViewOffset({
        popup: popupElement.getBoundingClientRect(),
        view: mapboxVisibleElementScreenRect(mapElement),
        padding: this.panIntoViewPaddingSignal()
      });

      if (x !== 0 || y !== 0) {
        mapInstance.panBy([x, y]);
      }
    }
  }
}
