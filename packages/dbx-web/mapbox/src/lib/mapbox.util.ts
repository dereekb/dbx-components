import { type LatLngBound, type LatLngPoint, type Vector, type VectorTuple } from '@dereekb/util';
import { bounds } from '@placemarkio/geo-viewport';
import { type MapboxTileSize, type MapboxZoomLevel } from './mapbox';

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

/**
 * Creates a function that calculates the geographic bounds of a Mapbox viewport given a center point and zoom level.
 *
 * @param config - Configuration specifying the map canvas size and optional tile size.
 * @returns A function that accepts a center point and zoom level and returns the corresponding {@link LatLngBound}.
 */
export function mapboxViewportBoundFunction(config: MapboxViewportBoundFunctionConfig): MapboxViewportBoundFunction {
  const { mapCanvasSize, tileSize = 512 } = config;
  const dimensions: VectorTuple = [mapCanvasSize.x, mapCanvasSize.y];
  return ({ center, zoom }) => {
    const boundingBox = bounds([center.lng, center.lat], zoom, dimensions, tileSize);
    const [swLng, swLat, neLng, neLat] = boundingBox;

    return {
      sw: { lat: swLat, lng: swLng },
      ne: { lat: neLat, lng: neLng }
    };
  };
}
