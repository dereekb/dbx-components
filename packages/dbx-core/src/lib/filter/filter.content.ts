import { FilterSource, FilterSourceConnector } from "@dereekb/rxjs";
import { forwardRef, Provider, Type } from '@angular/core';

/**
 * Angular provider convenience function for a FilterSource.
 */
export function provideFilterSource<S extends FilterSource>(sourceType: Type<S>): Provider[] {
  return [{
    provide: FilterSource,
    useExisting: forwardRef(() => sourceType)
  }];
}

/**
 * Angular provider convenience function for a FilterSourceConnector.
 */
export function provideFilterSourceConnector<S extends FilterSourceConnector>(sourceType: Type<S>): Provider[] {
  return [{
    provide: FilterSourceConnector,
    useExisting: forwardRef(() => sourceType)
  }, {
    provide: FilterSource,
    useExisting: forwardRef(() => sourceType)
  }];
}
