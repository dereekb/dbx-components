import { describe, expect, it } from 'vitest';
import { type LatLngPoint } from '@dereekb/util';
import { DBX_MAPBOX_CIRCLE_RING_STEPS, DBX_MAPBOX_EARTH_RADIUS_METERS, dbxMapboxCircleFeature, dbxMapboxCircleRadiusInMeters, dbxMapboxCircleRing } from './mapbox.circle';

const AUSTIN: LatLngPoint = { lat: 30.2712, lng: -97.7566 };

/**
 * Great-circle distance in meters, used to check the ring against an independent formula.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns The distance between the points in meters.
 */
function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const toRadians = (x: number) => (x * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * DBX_MAPBOX_EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

describe('dbxMapboxCircleRadiusInMeters()', () => {
  it('should default to meters', () => {
    expect(dbxMapboxCircleRadiusInMeters(250)).toBe(250);
  });

  it('should convert kilometers', () => {
    expect(dbxMapboxCircleRadiusInMeters(2, 'km')).toBe(2000);
  });

  it('should convert miles', () => {
    expect(dbxMapboxCircleRadiusInMeters(1, 'mi')).toBeCloseTo(1609.344, 6);
  });
});

describe('dbxMapboxCircleRing()', () => {
  it('should close the ring by repeating the first point', () => {
    const ring = dbxMapboxCircleRing(AUSTIN, 1000);
    expect(ring.length).toBe(DBX_MAPBOX_CIRCLE_RING_STEPS + 1);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });

  it('should place every point the radius away from the center', () => {
    dbxMapboxCircleRing(AUSTIN, 16093.44).forEach((point) => {
      expect(haversineMeters(AUSTIN, point)).toBeCloseTo(16093.44, 3);
    });
  });

  it('should start due north of the center', () => {
    const [first] = dbxMapboxCircleRing(AUSTIN, 1000);
    expect(first.lat).toBeGreaterThan(AUSTIN.lat);
    expect(first.lng).toBeCloseTo(AUSTIN.lng, 9);
  });

  it('should not wrap longitudes across the antimeridian', () => {
    const ring = dbxMapboxCircleRing({ lat: 0, lng: 179.99 }, 10000);
    expect(Math.max(...ring.map((x) => x.lng))).toBeGreaterThan(180);
  });
});

describe('dbxMapboxCircleFeature()', () => {
  it('should create a polygon of lng/lat positions', () => {
    const feature = dbxMapboxCircleFeature(AUSTIN, { radius: 1, radiusUnit: 'mi' });
    const [ring] = feature.geometry.coordinates;
    const [lng, lat] = ring[0];

    expect(feature.geometry.type).toBe('Polygon');
    expect(ring.length).toBe(DBX_MAPBOX_CIRCLE_RING_STEPS + 1);
    expect(lng).toBeCloseTo(AUSTIN.lng, 9);
    expect(lat).toBeGreaterThan(AUSTIN.lat);
  });

  it('should carry the label, or an empty string without one', () => {
    expect(dbxMapboxCircleFeature(AUSTIN, { radius: 1, label: '1 mile radius' }).properties.label).toBe('1 mile radius');
    expect(dbxMapboxCircleFeature(AUSTIN, { radius: 1 }).properties.label).toBe('');
  });
});
