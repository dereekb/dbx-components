import { DestroyRef, inject } from '@angular/core';
import { type Destroyable, type DestroyFunction } from '@dereekb/util';
import { type Subject } from 'rxjs';

/**
 * Wraps a Destroyable in a function that registers the input Destroyable to be destroyed
 * when the DestroyRef is destroyed in the context.
 *
 * Must be run in an Angular injection context.
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
 */
export function completeOnDestroy<T extends Pick<Subject<any>, 'complete' | 'error'>>(input: T): T {
  clean(() => input.complete());
  return input;
}
