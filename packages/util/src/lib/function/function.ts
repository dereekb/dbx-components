import { MAP_IDENTITY } from '../value/map';

/**
 * A function that returns the input value.
 *
 * Is an alias of the mapIdentityFunction, so it will return true when passed to isMapIdentityFunction().
 *
 * @param input
 * @returns
 */
export const passThrough = MAP_IDENTITY;
