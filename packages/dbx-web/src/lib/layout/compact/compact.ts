import { type Maybe } from '@dereekb/util';
import { type Observable, of, map } from 'rxjs';

/**
 * Represents the two display density modes: full (default) or compact (reduced spacing/content).
 */
export enum CompactMode {
  FULL = 'full',
  COMPACT = 'compact'
}

/**
 * Maps each compact mode to a corresponding value of type `T`.
 */
export interface CompactModeOptions<T> {
  full?: T;
  compact?: T;
}

/**
 * Extends {@link CompactModeOptions} with a default mode fallback used when no mode is provided.
 */
export interface CompactModeDefaultOptions<T> extends CompactModeOptions<T> {
  defaultMode?: Maybe<CompactMode>;
}

/**
 * Accepts either a `CompactMode` enum value or a boolean (`true` = compact, `false` = full).
 */
export type CompactModeOption = CompactMode | boolean;

/**
 * Converts a boolean or `CompactMode` value into a normalized `CompactMode`.
 * `true` maps to `CompactMode.COMPACT`, `false` maps to `CompactMode.FULL`.
 *
 * @example
 * ```ts
 * compactModeFromInput(true);  // CompactMode.COMPACT
 * compactModeFromInput(CompactMode.FULL);  // CompactMode.FULL
 * ```
 *
 * @param input - a boolean or CompactMode value to normalize
 * @returns the normalized CompactMode enum value
 */
export function compactModeFromInput(input: CompactMode | boolean): CompactMode {
  if (typeof input === 'boolean') {
    input = input ? CompactMode.COMPACT : CompactMode.FULL;
  }

  return input === CompactMode.COMPACT ? CompactMode.COMPACT : CompactMode.FULL;
}

/**
 * Maps an observable compact mode stream to the corresponding value from the config.
 * Falls back to the config's `defaultMode` (or `FULL`) when the observable is nullish.
 *
 * @example
 * ```ts
 * const value$ = mapCompactModeObs(mode$, {
 *   full: 'large-layout',
 *   compact: 'small-layout',
 *   defaultMode: CompactMode.FULL
 * });
 * ```
 *
 * @param mode$ - an observable of the current compact mode, or nullish to use the default
 * @param config - the mapping configuration containing values for each mode and an optional default
 * @returns an observable emitting the mapped value corresponding to the current compact mode
 */
export function mapCompactModeObs<T>(mode$: Maybe<Observable<CompactMode>>, config: CompactModeDefaultOptions<T>): Observable<Maybe<T>> {
  const modeObs = mode$ ?? of(config.defaultMode ?? CompactMode.FULL);
  return modeObs.pipe(
    map((inputMode) => {
      const isCompact = (inputMode ?? config.defaultMode) === CompactMode.COMPACT;

      return isCompact ? config.compact : config.full;
    })
  );
}
