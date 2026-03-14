import { Pipe, type PipeTransform } from '@angular/core';
import { type FirestoreModelKey, flatFirestoreModelKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * Angular pipe that flattens a Firestore model key path into a single string identifier.
 *
 * Returns an empty string for null/undefined input.
 *
 * @example
 * ```html
 * <span>{{ document.key | flatFirestoreModelKey }}</span>
 * ```
 */
@Pipe({ name: 'flatFirestoreModelKey', standalone: true })
export class FlatFirestoreModelKeyPipe implements PipeTransform {
  transform(input: Maybe<FirestoreModelKey>): string {
    if (input != null) {
      return flatFirestoreModelKey(input);
    } else {
      return '';
    }
  }
}
