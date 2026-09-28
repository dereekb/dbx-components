import { latLngPoint, type LatLngPointInput, type Pixels, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type KnownMapboxStyle, type MapboxBearing, type MapboxPitch, type MapboxZoomLevel } from './mapbox';

/**
 * Default style used by mapboxStaticImageUrl().
 */
export const DEFAULT_MAPBOX_STATIC_IMAGE_STYLE: KnownMapboxStyle = 'mapbox://styles/mapbox/satellite-streets-v12';

/**
 * Input for mapboxStaticImageUrl().
 */
export interface MapboxStaticImageUrlConfig {
  /**
   * Center of the image.
   */
  readonly latLng: LatLngPointInput;
  /**
   * Zoom level of the image.
   */
  readonly zoom: MapboxZoomLevel;
  /**
   * Image width. The Static Images API allows up to 1280.
   */
  readonly width: Pixels;
  /**
   * Image height. The Static Images API allows up to 1280.
   */
  readonly height: Pixels;
  /**
   * Mapbox access token used to request the image.
   */
  readonly accessToken: string;
  /**
   * Style to render, either as a style URL (mapbox://styles/username/style_id) or as "username/style_id".
   *
   * Defaults to DEFAULT_MAPBOX_STATIC_IMAGE_STYLE.
   */
  readonly style?: KnownMapboxStyle | string;
  readonly bearing?: MapboxBearing;
  readonly pitch?: MapboxPitch;
  /**
   * Whether to request the image at double resolution for high density screens.
   *
   * Defaults to true.
   */
  readonly retina?: boolean;
  /**
   * Whether to draw the Mapbox logo on the image.
   *
   * Defaults to false, for images shown next to a map that already displays it.
   */
  readonly logo?: boolean;
  /**
   * Whether to draw the attribution on the image.
   *
   * Defaults to false, for images shown next to a map that already displays it.
   */
  readonly attribution?: boolean;
}

/**
 * Creates a Mapbox Static Images API URL for an image of the map centered on a point.
 *
 * Useful as a placeholder picture of a place, e.g. the hero image of a map popup.
 *
 * @param config - What to render and how.
 * @returns The image URL.
 * @see https://docs.mapbox.com/api/maps/static-images/
 */
export function mapboxStaticImageUrl(config: MapboxStaticImageUrlConfig): WebsiteUrlWithPrefix {
  const { zoom, width, height, accessToken, style = DEFAULT_MAPBOX_STATIC_IMAGE_STYLE, bearing = 0, pitch = 0, retina = true, logo = false, attribution = false } = config;
  const { lat, lng } = latLngPoint(config.latLng);
  const styleId = style.replace(/^mapbox:\/\/styles\//, '');
  const size = `${Math.round(width)}x${Math.round(height)}${retina ? '@2x' : ''}`;
  const query = new URLSearchParams({ attribution: String(attribution), logo: String(logo), access_token: accessToken });
  return `https://api.mapbox.com/styles/v1/${styleId}/static/${lng},${lat},${zoom},${bearing},${pitch}/${size}?${query.toString()}`;
}
