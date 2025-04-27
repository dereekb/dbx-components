import { Pipe, PipeTransform } from '@angular/core';
import { FirestoreModelKey, flatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

@Pipe({ name: 'twoWayFlatFirestoreModelKey', standalone: true })
export class TwoWayFlatFirestoreModelKeyPipe implements PipeTransform {
  transform(input: Maybe<FirestoreModelKey>): string {
    if (input != null) {
      return twoWayFlatFirestoreModelKey(input);
    } else {
      return '';
    }
  }
}
