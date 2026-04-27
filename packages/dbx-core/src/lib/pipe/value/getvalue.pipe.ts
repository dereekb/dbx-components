import { Pipe, type PipeTransform } from '@angular/core';
import { type GetterOrValue, getValueFromGetter } from '@dereekb/util';

/**
 * Resolves a {@link GetterOrValue} to its underlying value using {@link getValueFromGetter}.
 *
 * This is an impure pipe that re-evaluates on every change detection cycle, making it suitable
 * for getter functions whose return value may change over time.
 * Use {@link GetValueOncePipe} (`getValueOnce`) for a pure alternative when the value is static.
 *
 * @dbxPipe
 * @dbxPipeSlug get-value
 * @dbxPipeCategory value
 * @dbxPipeRelated get-value-once
 * @dbxPipeSkillRefs dbx-value-pipes
 * @example
 * ```html
 * <span>{{ myGetterOrValue | getValue }}</span>
 * <span>{{ myGetterFn | getValue:someArg }}</span>
 * ```
 * @param args Optional argument forwarded to the getter function.
 */
@Pipe({
  name: 'getValue',
  standalone: true,
  pure: false
})
export class GetValuePipe implements PipeTransform {
  transform<T, A = any>(input: GetterOrValue<T>, args?: A): T {
    return getValueFromGetter(input as any, args);
  }
}

/**
 * Resolves a {@link GetterOrValue} to its underlying value using {@link getValueFromGetter}.
 *
 * This is a pure pipe that only re-evaluates when the input reference changes.
 * Use {@link GetValuePipe} (`getValue`) if the getter function's return value may change between cycles.
 *
 * @dbxPipe
 * @dbxPipeSlug get-value-once
 * @dbxPipeCategory value
 * @dbxPipeRelated get-value
 * @dbxPipeSkillRefs dbx-value-pipes
 * @example
 * ```html
 * <span>{{ myGetterOrValue | getValueOnce }}</span>
 * ```
 * @param args Optional argument forwarded to the getter function.
 */
@Pipe({
  name: 'getValueOnce',
  standalone: true,
  pure: true
})
export class GetValueOncePipe implements PipeTransform {
  transform<T, A = any>(input: GetterOrValue<T>, args?: A): T {
    return getValueFromGetter(input as any, args);
  }
}
