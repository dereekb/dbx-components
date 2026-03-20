import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { forwardRef, type Provider, type Type } from '@angular/core';

/**
 * Creates Angular providers that register a {@link FilterSource} implementation for DI.
 *
 * @param sourceType - The concrete filter source class to provide.
 * @returns An array of Angular providers for the filter source.
 *
 * @example
 * ```typescript
 * @Directive({
 *   selector: '[myFilterSource]',
 *   providers: provideFilterSource(MyFilterSourceDirective),
 * })
 * export class MyFilterSourceDirective { ... }
 * ```
 */
export function provideFilterSource<S extends FilterSource>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: FilterSource,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

/**
 * Creates Angular providers that register both a {@link FilterSourceConnector} and {@link FilterSource} for DI.
 *
 * @param sourceType - The concrete connector class to provide.
 * @returns An array of Angular providers for the filter source connector.
 */
export function provideFilterSourceConnector<S extends FilterSourceConnector>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: FilterSourceConnector,
      useExisting: forwardRef(() => sourceType)
    },
    {
      provide: FilterSource,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
