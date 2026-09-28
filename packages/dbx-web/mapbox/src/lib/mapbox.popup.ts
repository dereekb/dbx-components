import { type Pixels, type PixelsString } from '@dereekb/util';
import { type Anchor, type PointLike } from 'mapbox-gl';

/**
 * Screen-space box, in the same shape as a DOMRect.
 */
export interface DbxMapboxScreenRect {
  readonly left: Pixels;
  readonly top: Pixels;
  readonly right: Pixels;
  readonly bottom: Pixels;
}

/**
 * Offset of a popup from its anchor point. Same shape as the mapbox-gl Popup offset option.
 *
 * Use a per-anchor record when the popup's tail should keep a different distance from the marker depending on which side of the marker the popup opens.
 */
export type DbxMapboxPopupOffset = Pixels | PointLike | Record<Anchor, [Pixels, Pixels]>;

/**
 * Max width of a popup. Same shape as the mapbox-gl Popup maxWidth option.
 */
export type DbxMapboxPopupMaxWidth = PixelsString | 'none';

/**
 * Input for mapboxPopupAnchorOffset().
 */
export interface MapboxPopupAnchorOffsetConfig {
  /**
   * Horizontal distance between the popup's tail and the anchor point, used when the popup opens beside the marker.
   */
  readonly x: Pixels;
  /**
   * Vertical distance between the popup's tail and the anchor point, used when the popup opens above or below the marker.
   */
  readonly y: Pixels;
}

/**
 * Creates the offset for every anchor mapbox-gl may pick.
 *
 * When no fixed anchor is set, mapbox-gl places the popup on whichever side of the anchor point fits in the map, so each side needs its own offset.
 *
 * @param config - Distances to keep from the anchor point.
 * @returns The offset for each anchor.
 */
export function mapboxPopupAnchorOffset(config: MapboxPopupAnchorOffsetConfig): Record<Anchor, [Pixels, Pixels]> {
  const { x, y } = config;

  return {
    center: [0, 0],
    top: [0, y],
    'top-left': [0, y],
    'top-right': [0, y],
    bottom: [0, -y],
    'bottom-left': [0, -y],
    'bottom-right': [0, -y],
    left: [x, 0],
    right: [-x, 0]
  };
}

/**
 * Default popup offset. Fits a chip or small marker, which is wider than it is tall.
 */
export const DEFAULT_DBX_MAPBOX_POPUP_OFFSET = mapboxPopupAnchorOffset({ x: 36, y: 18 });

/**
 * Default space kept between a popup and the edge of the visible map when the map pans to fit the popup.
 */
export const DEFAULT_DBX_MAPBOX_POPUP_VIEW_PADDING: Pixels = 12;

/**
 * Returns the overlap of two boxes, e.g. the map's box clipped to the browser window.
 *
 * @param a - The first box.
 * @param b - The second box.
 * @returns The overlapping box.
 */
export function mapboxScreenRectIntersection(a: DbxMapboxScreenRect, b: DbxMapboxScreenRect): DbxMapboxScreenRect {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom)
  };
}

/**
 * Returns the part of the element the user can actually see: its box clipped by the browser window and by every ancestor that hides its overflow (a rounded map container, a drawer, the page).
 *
 * @param element - The element to measure, e.g. the map.
 * @returns The visible box, in screen space.
 */
export function mapboxVisibleElementScreenRect(element: Element): DbxMapboxScreenRect {
  let rect: DbxMapboxScreenRect = mapboxScreenRectIntersection(element.getBoundingClientRect(), {
    left: 0,
    top: 0,
    right: document.documentElement.clientWidth,
    bottom: document.documentElement.clientHeight
  });

  let ancestor = element.parentElement;

  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    const { overflowX, overflowY } = getComputedStyle(ancestor);

    if (overflowX !== 'visible' || overflowY !== 'visible') {
      rect = mapboxScreenRectIntersection(rect, ancestor.getBoundingClientRect());
    }

    ancestor = ancestor.parentElement;
  }

  return rect;
}

/**
 * Input for mapboxPopupPanIntoViewOffset().
 */
export interface MapboxPopupPanIntoViewOffsetInput {
  /**
   * Where the popup currently sits on screen.
   */
  readonly popup: DbxMapboxScreenRect;
  /**
   * The part of the map the user can actually see.
   */
  readonly view: DbxMapboxScreenRect;
  /**
   * Space to keep between the popup and the edge of the view.
   */
  readonly padding: Pixels;
}

/**
 * Pixel offset to pass to the map's panBy() so the popup ends up fully inside the view.
 *
 * A positive x/y pans the camera right/down, which moves the popup left/up. When the popup is larger than the view on an axis, its top/left edge is kept visible.
 *
 * @param input - The popup box, the visible box, and the padding to keep.
 * @returns The [x, y] pan offset. [0, 0] when the popup already fits.
 */
export function mapboxPopupPanIntoViewOffset(input: MapboxPopupPanIntoViewOffsetInput): [Pixels, Pixels] {
  const { popup, view, padding } = input;

  function axisOffset(popupRange: readonly [Pixels, Pixels], viewRange: readonly [Pixels, Pixels]): Pixels {
    const [popupStart, popupEnd] = popupRange;
    const start = viewRange[0] + padding;
    const end = viewRange[1] - padding;
    let offset = 0;

    if (popupStart < start || popupEnd - popupStart > end - start) {
      offset = popupStart - start;
    } else if (popupEnd > end) {
      offset = popupEnd - end;
    }

    return Math.round(offset);
  }

  return [axisOffset([popup.left, popup.right], [view.left, view.right]), axisOffset([popup.top, popup.bottom], [view.top, view.bottom])];
}
