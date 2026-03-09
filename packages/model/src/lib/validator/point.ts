import { isLatLngString, isValidLatLngPoint } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid {@link LatLngPoint} with lat in [-90, 90] and lng in [-180, 180].
 */
export const latLngPointType = type({
  lat: '-90 <= number <= 90',
  lng: '-180 <= number <= 180'
}).narrow((val, ctx) => (val != null && isValidLatLngPoint(val)) || ctx.mustBe('a valid LatLngPoint with lat in [-90, 90] and lng in [-180, 180]'));

/**
 * ArkType schema for a valid {@link LatLngString} (comma-separated lat/lng, e.g. "30.5,-96.3").
 */
export const latLngStringType = type('string > 0').narrow((val, ctx) => (val != null && isLatLngString(val)) || ctx.mustBe('a valid lat,lng string (e.g. "30.5,-96.3")'));
