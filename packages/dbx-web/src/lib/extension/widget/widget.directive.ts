import { Directive, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';

/**
 * Abstract base directive for widget components that automatically injects the widget data from the {@link DBX_INJECTION_COMPONENT_DATA} token.
 * Subclasses access the typed data through `this.data`.
 *
 * @example
 * ```typescript
 * @Component({ template: '<p>{{ data.name }}</p>' })
 * class MyWidget extends AbstractDbxWidgetComponent<MyData> {}
 * ```
 */
@Directive()
export abstract class AbstractDbxWidgetComponent<T> {
  readonly data = inject<T>(DBX_INJECTION_COMPONENT_DATA);
}
