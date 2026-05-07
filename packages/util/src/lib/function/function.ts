/**
 * Identity function that returns the input value unchanged.
 *
 * Alias of MAP_IDENTITY, so `isMapIdentityFunction()` will return true for this function.
 */
export { MAP_IDENTITY as passThrough } from '../value/map';

/**
 * No-op function. Useful as a default callback or as a yargs command's `handler` for parent
 * commands that only register subcommands.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function noop(): void {}
