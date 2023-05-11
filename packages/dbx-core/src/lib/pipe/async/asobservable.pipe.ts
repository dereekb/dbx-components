import { Pipe, PipeTransform } from '@angular/core';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { DateRange, formatToDayRangeString } from '@dereekb/date';
import { asObservable, asObservableFromGetter, ObservableOrValue, ObservableOrValueGetter } from '@dereekb/rxjs';
import { Observable } from 'rxjs';

/**
 * Pipes an ObservableOrValueGetter to an Observable value.
 */
@Pipe({ name: 'asObservable' })
export class AsObservablePipe implements PipeTransform {
  transform<T>(input: ObservableOrValueGetter<T>): Observable<T> {
    return asObservableFromGetter(input);
  }
}
