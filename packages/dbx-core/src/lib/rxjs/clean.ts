import { DestroyRef, inject } from '@angular/core';
import { type Destroyable, type DestroyFunction } from '@dereekb/util';
import { type Subject } from 'rxjs';

/**
 * Wraps a Destroyable in a function that registers the input Destroyable to be destroyed
 * when the DestroyRef is destroyed in the context.
 *
 * Must be run in an Angular injection context.
 *
 * @example
 * // Clean up a Destroyable object (e.g., SubscriptionObject, LockSet):
 * const sub = new SubscriptionObject(obs$.subscribe(handler));
 * clean(sub);
 *
 * @example
 * // Clean up a destroy function directly:
 * clean(() => resource.release());
 *
 * @param input - The Destroyable object or destroy function to register for cleanup.
 * @returns The same input, for chaining.
 */
export function clean<T extends Destroyable | DestroyFunction>(input: T): T {
  const destroyRef = inject(DestroyRef);

  if ((input as Destroyable).destroy) {
    destroyRef.onDestroy(() => (input as Destroyable).destroy());
  } else {
    destroyRef.onDestroy(input as DestroyFunction);
  }

  return input;
}

/**
 * Wraps a Subject in a function that registers the input Subject to be completed
 * when the DestroyRef is destroyed in the context.
 *
 * Must be run in an Angular injection context.
 *
 * @example
 * // Complete a BehaviorSubject when the component is destroyed:
 * readonly value$ = completeOnDestroy(new BehaviorSubject<string>('initial'));
 *
 * @example
 * // Complete a ReplaySubject when the component is destroyed:
 * readonly events$ = completeOnDestroy(new ReplaySubject<Event>(1));
 *
 * @param input - The Subject to register for completion on destroy.
 * @returns The same input, for chaining.
 */
export function completeOnDestroy<T extends Pick<Subject<unknown>, 'complete' | 'error'>>(input: T): T {
  clean(() => input.complete());
  return input;
}
