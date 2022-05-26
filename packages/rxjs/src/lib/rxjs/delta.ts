import { filter, map, MonoTypeOperatorFunction, Observable, scan } from 'rxjs';

/**
 * onDelta function configuration.
 */
export interface OnMatchDeltaConfig<T> {
  /**
   * The first from value.
   */
  from: T;
  /**
   * The target value to recieve after the first.
   */
  to: T;
  /**
   * Comparison function to compare equality between the emission and the target values.
   *
   * isMatch is checked for each value, and at the time a match is found, allowing a double check to occur on the from target value.
   */
  isMatch?: (a: T, b: T) => boolean;
  /**
   * Whether or not the two values must be emitted consencutively.
   *
   * For example, if requiredConsecutive=true and we are waiting for 1 -> 2, and the emissions are 1,0,2, the observable function will not emit 2.
   */
  requireConsecutive?: boolean;
}

interface OnMatchDeltaScan<T> {
  /**
   * Whether or not to emit.
   */
  emit: boolean; // null for the initial value.
  /**
   * Whether or not a from match has been hit.
   *
   * In cases of requireConsecutive=false, this value retains true until emit occurs.
   */
  fromMatch: boolean;
  /**
   * The current fromMatch value.
   */
  value: T;
}

/**
 * Emits a value when going from one matching value to a target value.
 *
 * The first value must be determined first before the second is raised.
 */
export function onMatchDelta<T>(config: OnMatchDeltaConfig<T>): MonoTypeOperatorFunction<T> {
  const { isMatch: inputIsSame, from, to, requireConsecutive } = config;
  const isMatch = inputIsSame ?? ((a: T, b: T) => a === b);

  return (obs: Observable<T>) => {
    return obs.pipe(
      scan(
        (acc: OnMatchDeltaScan<T>, next: T) => {
          let emit: boolean = false;
          let fromMatch: boolean = acc.fromMatch;
          let value!: T;

          // If we do have a match check the next value is a match for delta emission.
          if (acc.fromMatch) {
            const toMatch = isMatch(to, next);

            if (toMatch) {
              // if the two value matches, check fromMatch once more
              fromMatch = isMatch(from, acc.value);

              // emit if both are in agreement
              emit = fromMatch && toMatch;

              if (emit) {
                // set the emit value
                value = next;

                // set fromMatch for the followup emission
                fromMatch = isMatch(from, next);
              }
            }
          }

          // If we aren't emitting, update fromMatch/value depending on current state.
          if (!emit) {
            // if we don't have a from match yet or we require consecutive successes, check next as the from value.
            if (!acc.fromMatch || requireConsecutive) {
              fromMatch = isMatch(from, next);
              value = next;
            }
          }

          return {
            emit,
            value,
            fromMatch
          };
        },
        { emit: false, fromMatch: false, value: 0 as unknown as T }
      ),
      filter(({ emit }) => Boolean(emit)),
      map(({ value }) => value)
    );
  };
}
