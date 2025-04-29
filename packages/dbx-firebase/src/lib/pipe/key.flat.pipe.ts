import { Pipe, PipeTransform } from '@angular/core';
import { FirestoreModelKey, flatFirestoreModelKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

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
