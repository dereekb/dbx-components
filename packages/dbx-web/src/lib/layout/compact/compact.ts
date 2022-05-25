import { Maybe } from '@dereekb/util';
import { isBoolean } from 'class-validator';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';

export enum CompactMode {
  FULL = 'full',
  COMPACT = 'compact'
}

export interface CompactModeOptions<T> {
  full?: T;
  compact?: T;
}

export interface CompactModeDefaultOptions<T> extends CompactModeOptions<T> {
  defaultMode?: Maybe<CompactMode>;
}

export type CompactModeOption = CompactMode | boolean;

export function compactModeFromInput(input: CompactMode | boolean): CompactMode {
  if (isBoolean(input)) {
    input = (input) ? CompactMode.COMPACT : CompactMode.FULL;
  }

  return input === CompactMode.COMPACT ? CompactMode.COMPACT : CompactMode.FULL;
}

export function mapCompactModeObs<T>(mode$: Maybe<Observable<CompactMode>>, config: CompactModeDefaultOptions<T>): Observable<Maybe<T>> {
  const modeObs = mode$ ?? of(config.defaultMode ?? CompactMode.FULL);
  return modeObs.pipe(
    map((inputMode) => {
      const isCompact = ((inputMode ?? config.defaultMode) === CompactMode.COMPACT);

      if (isCompact) {
        return config.compact;
      } else {
        return config.full;
      }
    })
  );
}