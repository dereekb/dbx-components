import { Directive, Inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';

@Directive()
export abstract class AbstractDbxWidgetComponent<T> {
  constructor(@Inject(DBX_INJECTION_COMPONENT_DATA) readonly data: T) {}
}
