import { LatLngPointInput, LatLngBoundInput, ZoomLevel, ZoomLevelRange, ExtendLatLngBoundInput } from '@dereekb/util';
import * as MapboxGl from 'mapbox-gl';

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

export type DbxMapboxClickEvent = MapboxGl.MapMouseEvent & MapboxGl.EventData;

export interface MapboxStyleConfig {
  style: MapboxGl.Style | string;
  options?: {
    diff?: boolean | undefined;
    localIdeographFontFamily?: string | undefined;
  };
}

export interface MapboxFitPositions {
  positions: ExtendLatLngBoundInput;
  options?: mapboxgl.FitBoundsOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxFitBounds {
  bounds: LatLngBoundInput;
  options?: mapboxgl.FitBoundsOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxJumpToPositionOptions extends Omit<MapboxGl.CameraOptions, 'center'> {
  center: LatLngPointInput;
}

export interface MapboxJumpTo {
  center?: LatLngPointInput;
  to?: MapboxJumpToPositionOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxEaseToPositionOptions extends Omit<MapboxGl.EaseToOptions, 'center'>, MapboxJumpToPositionOptions {}

export interface MapboxEaseTo {
  center?: LatLngPointInput;
  to?: MapboxEaseToPositionOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxFlyToPositionOptions extends Omit<MapboxGl.FlyToOptions, 'center'>, MapboxJumpToPositionOptions {}

export interface MapboxFlyTo {
  center?: LatLngPointInput;
  to?: MapboxFlyToPositionOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxRotateTo {
  bearing: MapboxBearing;
  options?: mapboxgl.AnimationOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxResetNorth {
  options?: mapboxgl.AnimationOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxResetNorthPitch {
  options?: mapboxgl.AnimationOptions;
  eventData?: mapboxgl.EventData;
}

export interface MapboxSnapToNorth {
  options?: mapboxgl.AnimationOptions;
  eventData?: mapboxgl.EventData;
}
