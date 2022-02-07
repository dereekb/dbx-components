import { FilterSource, FilterSourceConnector } from "@dereekb/rxjs";
import { forwardRef, Provider, Type } from '@angular/core';

/**
 * Angular provider convenience function for a FilterSource.
 */
export function ProvideFilterSource<S extends FilterSource<any>>(sourceType: Type<S>): Provider[] {
  return [{
    provide: FilterSource,
    useExisting: forwardRef(() => sourceType)
  }];
}

/**
 * Angular provider convenience function for a FilterSourceConnector.
 */
export function ProvideFilterSourceConnector<S extends FilterSourceConnector<any>>(sourceType: Type<S>): Provider[] {
  return [{
    provide: FilterSourceConnector,
    useExisting: forwardRef(() => sourceType)
  }, {
    provide: FilterSource,
    useExisting: forwardRef(() => sourceType)
  }];
}
