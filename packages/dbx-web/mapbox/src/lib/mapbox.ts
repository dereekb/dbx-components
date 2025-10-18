import { type LatLngPointInput, type LatLngBoundInput, type ZoomLevel, type ZoomLevelRange, type ExtendLatLngBoundInput } from '@dereekb/util';
import type * as MapboxGl from 'mapbox-gl';

/**
 * List of styles that are defined here:
 *
 * https://docs.mapbox.com/api/maps/styles/
 */
export type KnownMapboxStyle = 'mapbox://styles/mapbox/standard' | 'mapbox://styles/mapbox/streets-v12' | 'mapbox://styles/mapbox/outdoors-v12' | 'mapbox://styles/mapbox/light-v11' | 'mapbox://styles/mapbox/dark-v11' | 'mapbox://styles/mapbox/satellite-v9' | 'mapbox://styles/mapbox/satellite-streets-v12' | 'mapbox://styles/mapbox/navigation-day-v1' | 'mapbox://styles/mapbox/navigation-night-v1';

export const KNOWN_MAPBOX_STYLES: KnownMapboxStyle[] = [
  // standard
  'mapbox://styles/mapbox/standard',
  // classic
  'mapbox://styles/mapbox/streets-v12',
  'mapbox://styles/mapbox/outdoors-v12',
  'mapbox://styles/mapbox/light-v11',
  'mapbox://styles/mapbox/dark-v11',
  'mapbox://styles/mapbox/satellite-v9',
  'mapbox://styles/mapbox/satellite-streets-v12',
  'mapbox://styles/mapbox/navigation-day-v1',
  'mapbox://styles/mapbox/navigation-night-v1'
];

export type MapboxEventData = object;

export type MapboxZoomLevel = ZoomLevel;
export type MapboxZoomLevelRange = ZoomLevelRange;

export const MAPBOX_MIN_ZOOM_LEVEL: MapboxZoomLevel = 0;
export const MAPBOX_MAX_ZOOM_LEVEL: MapboxZoomLevel = 22;

export function mapboxZoomLevel(input: number): MapboxZoomLevel {
  return Math.min(Math.max(input, MAPBOX_MIN_ZOOM_LEVEL), MAPBOX_MAX_ZOOM_LEVEL);
}

export type MapboxPitch = number;
export type MapboxBearing = number;

/**
 * Size of the tiles. Vector-based tiles used by the web are generally 512x512, and legacy ones are 256x256.
 *
 * https://blog.mapbox.com/512-map-tiles-cb5bfd6e72ba
 */
export type MapboxTileSize = 512 | 256;

export type DbxMapboxClickEvent = MapboxGl.MapMouseEvent & MapboxEventData;

/**
 * Options for MapboxGl.Map.fitBounds()
 */
export type MapboxFitBoundsOptions = Parameters<MapboxGl.Map['fitBounds']>[1];

/**
 * Options for MapboxGl.Map.easeTo()
 */
export type MapboxEaseToOptions = Parameters<MapboxGl.Map['easeTo']>[0];

/**
 * Options for MapboxGl.Map.flyTo()
 */
export type MapboxFlyToOptions = Parameters<MapboxGl.Map['flyTo']>[0];

/**
 * Options for MapboxGl.Map.setStyle()
 */
export type MapboxSetStyleOptions = Parameters<MapboxGl.Map['setStyle']>[1];

export interface MapboxStyleConfig {
  style: MapboxGl.StyleSpecification | string;
  options?: MapboxSetStyleOptions;
}

export interface MapboxFitPositions {
  positions: ExtendLatLngBoundInput;
  options?: MapboxFitBoundsOptions;
  eventData?: MapboxEventData;
}

export interface MapboxFitBounds {
  bounds: LatLngBoundInput;
  options?: MapboxFitBoundsOptions;
  eventData?: MapboxEventData;
}

export interface MapboxJumpToPositionOptions extends Omit<MapboxGl.CameraOptions, 'center'> {
  center: LatLngPointInput;
}

export interface MapboxJumpTo {
  center?: LatLngPointInput;
  to?: MapboxJumpToPositionOptions;
  eventData?: MapboxEventData;
}

export interface MapboxEaseToPositionOptions extends Omit<MapboxEaseToOptions, 'center'>, MapboxJumpToPositionOptions {}

export interface MapboxEaseTo {
  center?: LatLngPointInput;
  to?: MapboxEaseToPositionOptions;
  eventData?: MapboxEventData;
}

export interface MapboxFlyToPositionOptions extends Omit<MapboxFlyToOptions, 'center'>, MapboxJumpToPositionOptions {}

export interface MapboxFlyTo {
  center?: LatLngPointInput;
  to?: MapboxFlyToPositionOptions;
  eventData?: MapboxEventData;
}

export interface MapboxRotateTo {
  bearing: MapboxBearing;
  options?: mapboxgl.AnimationOptions;
  eventData?: MapboxEventData;
}

export interface MapboxResetNorth {
  options?: mapboxgl.AnimationOptions;
  eventData?: MapboxEventData;
}

export interface MapboxResetNorthPitch {
  options?: mapboxgl.AnimationOptions;
  eventData?: MapboxEventData;
}

export interface MapboxSnapToNorth {
  options?: mapboxgl.AnimationOptions;
  eventData?: MapboxEventData;
}
