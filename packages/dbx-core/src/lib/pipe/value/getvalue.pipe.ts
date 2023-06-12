import { Pipe, PipeTransform } from '@angular/core';
import { asObservableFromGetter, ObservableOrValueGetter } from '@dereekb/rxjs';
import { FactoryWithRequiredInput, GetterOrValue, getValueFromGetter } from '@dereekb/util';
import { Observable } from 'rxjs';

/**
 * Retrieves the value from the getter. This is a non-pure pipe. Use the getValueOncePipe instead for a pure pipe.
 */
@Pipe({
  name: 'getValue',
  pure: false
})
export class GetValuePipe implements PipeTransform {
  transform<T, A = any>(input: GetterOrValue<T>, args?: A): T {
    return getValueFromGetter(input as any, args);
  }
}

/**
 * Pipes a GetValuePipe to an Observable value.
 */
@Pipe({
  name: 'getValueOnce',
  pure: true
})
export class GetValueOncePipe implements PipeTransform {
  transform<T, A = any>(input: GetterOrValue<T>, args?: A): T {
    return getValueFromGetter(input as any, args);
  }
}
