import { Pipe, type PipeTransform } from '@angular/core';
import { type GetterOrValue, getValueFromGetter } from '@dereekb/util';

/**
 * Resolves a {@link GetterOrValue} to its underlying value using {@link getValueFromGetter}.
 *
 * This is an impure pipe that re-evaluates on every change detection cycle, making it suitable
 * for getter functions whose return value may change over time.
 * Use {@link GetValueOncePipe} (`getValueOnce`) for a pure alternative when the value is static.
 *
 * @example
 * ```html
 * <span>{{ myGetterOrValue | getValue }}</span>
 * <span>{{ myGetterFn | getValue:someArg }}</span>
 * ```
 */
@Pipe({
  name: 'getValue',
  standalone: true,
  pure: false
})
export class GetValuePipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform<T, A = any>(input: GetterOrValue<T>, args?: A): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getValueFromGetter(input as any, args);
  }
}

/**
 * Resolves a {@link GetterOrValue} to its underlying value using {@link getValueFromGetter}.
 *
 * This is a pure pipe that only re-evaluates when the input reference changes.
 * Use {@link GetValuePipe} (`getValue`) if the getter function's return value may change between cycles.
 *
 * @example
 * ```html
 * <span>{{ myGetterOrValue | getValueOnce }}</span>
 * ```
 */
@Pipe({
  name: 'getValueOnce',
  standalone: true,
  pure: true
})
export class GetValueOncePipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform<T, A = any>(input: GetterOrValue<T>, args?: A): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getValueFromGetter(input as any, args);
  }
}
