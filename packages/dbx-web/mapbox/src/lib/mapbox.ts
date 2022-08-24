import { LatLngPointInput, LatLngBoundInput } from '@dereekb/util';
import * as MapboxGl from 'mapbox-gl';

export type KnownMapboxStyle = 'mapbox://styles/mapbox/streets-v11' | 'mapbox://styles/mapbox/outdoors-v11' | 'mapbox://styles/mapbox/light-v10' | 'mapbox://styles/mapbox/dark-v10' | 'mapbox://styles/mapbox/satellite-v9' | 'mapbox://styles/mapbox/satellite-streets-v11' | 'mapbox://styles/mapbox/navigation-day-v1' | 'mapbox://styles/mapbox/navigation-night-v1';

export const KNOWN_MAPBOX_STYLES: KnownMapboxStyle[] = [
  //
  'mapbox://styles/mapbox/streets-v11',
  'mapbox://styles/mapbox/outdoors-v11',
  'mapbox://styles/mapbox/light-v10',
  'mapbox://styles/mapbox/dark-v10',
  'mapbox://styles/mapbox/satellite-v9',
  'mapbox://styles/mapbox/satellite-streets-v11',
  'mapbox://styles/mapbox/navigation-day-v1',
  'mapbox://styles/mapbox/navigation-night-v1'
];

export type MapboxZoomLevel = number;
export type MapboxPitch = number;
export type MapboxBearing = number;

export type DbxMapboxClickEvent = MapboxGl.MapMouseEvent & MapboxGl.EventData;

export interface MapboxStyleConfig {
  style: MapboxGl.Style | string;
  options?: {
    diff?: boolean | undefined;
    localIdeographFontFamily?: string | undefined;
  };
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
