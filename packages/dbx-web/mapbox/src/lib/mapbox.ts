import * as MapboxGl from 'mapbox-gl';

export type MapboxZoomLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export interface MapboxStyleConfig {
  style: MapboxGl.Style | string;
  options?: {
    diff?: boolean | undefined;
    localIdeographFontFamily?: string | undefined;
  };
}
