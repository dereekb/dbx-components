import { LatLngBound, LatLngPoint, Vector, VectorTuple } from '@dereekb/util';
import { bounds } from '@placemarkio/geo-viewport';
import { MapboxTileSize, MapboxZoomLevel } from './mapbox';

export interface MapboxViewportBoundFunctionConfig {
  readonly mapCanvasSize: Vector;
  /**
   * Mapbox tilesize being used. Defaults to 512x512.
   */
  readonly tileSize?: MapboxTileSize;
}

/**
 * Input for MapboxViewportBoundFunction.
 */
export interface MapboxViewportBoundFunctionInput {
  /**
   * Center of the viewport
   */
  readonly center: LatLngPoint;
  /**
   * Zoom level
   */
  readonly zoom: MapboxZoomLevel;
}

/**
 * Used to calculate the bounds of a view/object given the input MapboxViewportBoundFunctionInput.
 */
export type MapboxViewportBoundFunction = (input: MapboxViewportBoundFunctionInput) => LatLngBound;

export function mapboxViewportBoundFunction(config: MapboxViewportBoundFunctionConfig): MapboxViewportBoundFunction {
  const { mapCanvasSize, tileSize = 512 } = config;
  const dimensions: VectorTuple = [mapCanvasSize.x, mapCanvasSize.y];
  return ({ center, zoom }) => {
    const boundingBox = bounds([center.lng, center.lat], zoom, dimensions, tileSize);
    const [swLng, swLat, neLng, neLat] = boundingBox;

    const result = {
      sw: { lat: swLat, lng: swLng },
      ne: { lat: neLat, lng: neLng }
    };

    return result;
  };
}
