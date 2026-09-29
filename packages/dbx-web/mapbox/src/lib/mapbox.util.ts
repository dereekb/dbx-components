import { type LatLngBound, type LatLngPoint, type Vector, type VectorTuple } from '@dereekb/util';
import { bounds } from '@placemarkio/geo-viewport';
import { type DbxMapboxRightClickEvent, type MapboxTileSize, type MapboxZoomLevel } from './mapbox';

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
 * @returns Accepts a center point and zoom level and returns the corresponding {@link LatLngBound}.
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

// MARK: Client Points
/**
 * The parts of the map's canvas container used to convert between client (viewport) and map canvas positions.
 */
export type MapboxCanvasContainerLike = Pick<HTMLElement, 'getBoundingClientRect' | 'offsetWidth'>;

export interface MapboxCanvasContainerPointInput {
  readonly container: MapboxCanvasContainerLike;
  readonly point: Vector;
}

/**
 * Returns the container's CSS scaling, the same way mapbox computes it for mouse positions. It is 1 unless the map is inside a CSS transform.
 *
 * @param container - The map's canvas container.
 * @param rect - The container's bounding client rect.
 * @returns The scaling from client pixels to map canvas pixels.
 */
function mapboxCanvasContainerScaling(container: MapboxCanvasContainerLike, rect: DOMRect): number {
  return container.offsetWidth === rect.width || !rect.width ? 1 : container.offsetWidth / rect.width;
}

/**
 * Converts a client (viewport) position, such as a touch's clientX/clientY, to a position on the map canvas.
 *
 * @param input - The canvas container and the client position.
 * @returns The map canvas position, which map.unproject() turns into coordinates.
 */
export function mapboxClientPointToMapPoint(input: MapboxCanvasContainerPointInput): Vector {
  const { container, point } = input;
  const rect = container.getBoundingClientRect();
  const scaling = mapboxCanvasContainerScaling(container, rect);
  return { x: (point.x - rect.left) * scaling, y: (point.y - rect.top) * scaling };
}

/**
 * Converts a position on the map canvas, such as a map event's point, to a client (viewport) position.
 *
 * @param input - The canvas container and the map canvas position.
 * @returns The client position.
 */
export function mapboxMapPointToClientPoint(input: MapboxCanvasContainerPointInput): Vector {
  const { container, point } = input;
  const rect = container.getBoundingClientRect();
  const scaling = mapboxCanvasContainerScaling(container, rect);
  return { x: rect.left + point.x / scaling, y: rect.top + point.y / scaling };
}

/**
 * Returns the client (viewport) position of a right-click or long press event, for positioning a menu at it.
 *
 * @param event - The right-click or long press event.
 * @returns The client position.
 */
export function dbxMapboxRightClickEventClientPosition(event: DbxMapboxRightClickEvent): Vector {
  return mapboxMapPointToClientPoint({ container: event.target.getCanvasContainer(), point: event.point });
}
