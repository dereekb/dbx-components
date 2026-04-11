import { Pipe, type PipeTransform } from '@angular/core';
import { type FirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * Angular pipe that converts a Firestore model key to a two-way flat key format,
 * enabling reversible encoding/decoding of the full path.
 *
 * Returns an empty string for null/undefined input.
 *
 * @example
 * ```html
 * <span>{{ document.key | twoWayFlatFirestoreModelKey }}</span>
 * ```
 */
@Pipe({ name: 'twoWayFlatFirestoreModelKey', standalone: true })
export class TwoWayFlatFirestoreModelKeyPipe implements PipeTransform {
  transform(input: Maybe<FirestoreModelKey>): string {
    return input != null ? twoWayFlatFirestoreModelKey(input) : '';
  }
}
