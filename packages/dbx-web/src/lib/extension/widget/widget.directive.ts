import { Directive, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';

@Directive()
export abstract class AbstractDbxWidgetComponent<T> {
  readonly data = inject<T>(DBX_INJECTION_COMPONENT_DATA);
}
