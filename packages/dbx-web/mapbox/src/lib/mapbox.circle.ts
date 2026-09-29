import { type LatLngInputRef, type LatLngPoint, type Maybe, type UniqueModel } from '@dereekb/util';

// MARK: Radius
/**
 * Unit a {@link DbxMapboxCircle} radius is measured in.
 *
 * - m: meters
 * - km: kilometers
 * - mi: miles
 */
export type DbxMapboxCircleRadiusUnit = 'm' | 'km' | 'mi';

/**
 * Number of meters in one of each {@link DbxMapboxCircleRadiusUnit}.
 */
export const DBX_MAPBOX_CIRCLE_METERS_PER_RADIUS_UNIT: Readonly<Record<DbxMapboxCircleRadiusUnit, number>> = {
  m: 1,
  km: 1000,
  mi: 1609.344
};

/**
 * Mean radius of the Earth in meters, used to trace a circle's ring on the globe.
 */
export const DBX_MAPBOX_EARTH_RADIUS_METERS = 6371008.8;

/**
 * Number of points {@link dbxMapboxCircleRing} places around a circle.
 */
export const DBX_MAPBOX_CIRCLE_RING_STEPS = 64;

/**
 * Default color of a {@link DbxMapboxCircle}'s fill, outline, and label.
 */
export const DEFAULT_DBX_MAPBOX_CIRCLE_COLOR = '#1a73e8';

/**
 * Default opacity of a {@link DbxMapboxCircle}'s fill.
 */
export const DEFAULT_DBX_MAPBOX_CIRCLE_FILL_OPACITY = 0.1;

/**
 * Default opacity of a {@link DbxMapboxCircle}'s outline.
 */
export const DEFAULT_DBX_MAPBOX_CIRCLE_LINE_OPACITY = 1;

/**
 * Default opacity of a {@link DbxMapboxCircle}'s label.
 */
export const DEFAULT_DBX_MAPBOX_CIRCLE_LABEL_OPACITY = 1;

/**
 * Converts a radius to meters.
 *
 * @param radius - The radius.
 * @param unit - The unit the radius is in. Defaults to meters.
 * @returns The radius in meters.
 */
export function dbxMapboxCircleRadiusInMeters(radius: number, unit?: Maybe<DbxMapboxCircleRadiusUnit>): number {
  return radius * DBX_MAPBOX_CIRCLE_METERS_PER_RADIUS_UNIT[unit ?? 'm'];
}

// MARK: Circle
export interface DbxMapboxCircleDisplayConfig {
  /**
   * Radius of the circle, in {@link radiusUnit}.
   */
  readonly radius: number;
  /**
   * Unit the radius is in. Defaults to meters.
   */
  readonly radiusUnit?: Maybe<DbxMapboxCircleRadiusUnit>;
  /**
   * Text repeated along the circle's edge, such as "5 mile radius".
   */
  readonly label?: Maybe<string>;
  /**
   * Color of the fill, outline, and label. Defaults to {@link DEFAULT_DBX_MAPBOX_CIRCLE_COLOR}.
   */
  readonly color?: Maybe<string>;
  /**
   * Opacity of the fill, from 0 to 1. Defaults to {@link DEFAULT_DBX_MAPBOX_CIRCLE_FILL_OPACITY}.
   */
  readonly fillOpacity?: Maybe<number>;
  /**
   * Opacity of the outline, from 0 to 1. Defaults to {@link DEFAULT_DBX_MAPBOX_CIRCLE_LINE_OPACITY}.
   */
  readonly lineOpacity?: Maybe<number>;
  /**
   * Opacity of the label, from 0 to 1. Defaults to {@link DEFAULT_DBX_MAPBOX_CIRCLE_LABEL_OPACITY}.
   */
  readonly labelOpacity?: Maybe<number>;
}

/**
 * A circle drawn on the map at a real-world radius around its center, so it grows and shrinks with the zoom.
 */
export type DbxMapboxCircle = UniqueModel & LatLngInputRef & DbxMapboxCircleDisplayConfig;

/**
 * Properties of the feature {@link dbxMapboxCircleFeature} creates, read by the circle's label layer.
 */
export interface DbxMapboxCircleFeatureProperties {
  readonly label: string;
}

/**
 * Builds a closed ring of points that trace the circle of `radiusInMeters` around `center`.
 *
 * Each point is the great-circle destination from the center at an evenly spaced bearing, starting due north. The last point repeats the first to close the ring.
 * Longitudes are not wrapped, so a ring that crosses the antimeridian stays continuous.
 *
 * @param center - The center of the circle.
 * @param radiusInMeters - The radius of the circle in meters.
 * @returns The ring's {@link DBX_MAPBOX_CIRCLE_RING_STEPS} points, with the first point repeated at the end.
 */
export function dbxMapboxCircleRing(center: LatLngPoint, radiusInMeters: number): LatLngPoint[] {
  const radiansPerDegree = Math.PI / 180;
  const lat1 = center.lat * radiansPerDegree;
  const lng1 = center.lng * radiansPerDegree;
  const angularDistance = radiusInMeters / DBX_MAPBOX_EARTH_RADIUS_METERS;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinDistance = Math.sin(angularDistance);
  const cosDistance = Math.cos(angularDistance);

  const ring: LatLngPoint[] = [];

  for (let i = 0; i < DBX_MAPBOX_CIRCLE_RING_STEPS; i += 1) {
    const bearing = (2 * Math.PI * i) / DBX_MAPBOX_CIRCLE_RING_STEPS;
    const lat2 = Math.asin(sinLat1 * cosDistance + cosLat1 * sinDistance * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * sinDistance * cosLat1, cosDistance - sinLat1 * Math.sin(lat2));
    ring.push({ lat: lat2 / radiansPerDegree, lng: lng2 / radiansPerDegree });
  }

  ring.push(ring[0]);

  return ring;
}

/**
 * Creates the GeoJSON polygon feature that draws a circle on the map.
 *
 * @param center - The center of the circle.
 * @param circle - The circle's radius and label.
 * @returns A polygon feature whose `label` property is the circle's label, or an empty string.
 */
export function dbxMapboxCircleFeature(center: LatLngPoint, circle: Pick<DbxMapboxCircleDisplayConfig, 'radius' | 'radiusUnit' | 'label'>): GeoJSON.Feature<GeoJSON.Polygon, DbxMapboxCircleFeatureProperties> {
  const ring = dbxMapboxCircleRing(center, dbxMapboxCircleRadiusInMeters(circle.radius, circle.radiusUnit));

  return {
    type: 'Feature',
    properties: { label: circle.label ?? '' },
    geometry: {
      type: 'Polygon',
      coordinates: [ring.map((x) => [x.lng, x.lat])]
    }
  };
}
