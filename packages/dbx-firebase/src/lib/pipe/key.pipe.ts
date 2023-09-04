import { Pipe, PipeTransform } from '@angular/core';
import { FirestoreModelKey, flatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

@Pipe({ name: 'flatFirestoreModelKey' })
export class FlatFirestoreModelKeyPipe implements PipeTransform {
  transform(input: Maybe<FirestoreModelKey>): string {
    if (input != null) {
      return flatFirestoreModelKey(input);
    } else {
      return '';
    }
  }
}

@Pipe({ name: 'twoWayFlatFirestoreModelKey' })
export class TwoWayFlatFirestoreModelKeyPipe implements PipeTransform {
  transform(input: Maybe<FirestoreModelKey>): string {
    if (input != null) {
      return twoWayFlatFirestoreModelKey(input);
    } else {
      return '';
    }
  }
}
