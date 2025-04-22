import { Pipe, PipeTransform } from '@angular/core';
import { asObservableFromGetter, ObservableOrValueGetter } from '@dereekb/rxjs';
import { Observable } from 'rxjs';

/**
 * Pipes an ObservableOrValueGetter to an Observable value.
 */
@Pipe({
  name: 'asObservable',
  standalone: true
})
export class AsObservablePipe implements PipeTransform {
  transform<T>(input: ObservableOrValueGetter<T>): Observable<T> {
    return asObservableFromGetter(input);
  }
}
