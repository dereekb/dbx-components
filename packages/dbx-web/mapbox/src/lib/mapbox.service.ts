import { Injectable, Optional } from '@angular/core';
import { LatLngInput } from '@dereekb/util';
import { MapboxOptions } from 'mapbox-gl';
import { MapboxZoomLevel } from './mapbox';

export class DbxMapboxConfig {
  readonly defaultStyle?: MapboxOptions['style'];
  readonly defaultZoom?: MapboxZoomLevel;
  readonly defaultCenter?: LatLngInput;
}

export const DEFAULT_MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v11';
export const DEFAULT_MAPBOX_CENTER: LatLngInput = [30.2690138665, -97.7408297965];
export const DEFAULT_MAPBOX_ZOOM: MapboxZoomLevel = 12;

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

@Injectable({
  providedIn: 'root'
})
export class DbxMapboxService {
  private readonly _config: DbxMapboxConfig;

  constructor(@Optional() config: DbxMapboxConfig) {
    this._config = config ?? {};
  }

  get defaultStyle() {
    return this._config.defaultStyle ?? DEFAULT_MAPBOX_STYLE;
  }

  get defaultZoom(): MapboxZoomLevel {
    return this._config.defaultZoom ?? DEFAULT_MAPBOX_ZOOM;
  }

  get defaultCenter(): LatLngInput {
    return this._config.defaultCenter ?? DEFAULT_MAPBOX_CENTER;
  }
}
