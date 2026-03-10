import { Directive, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { type ReadableError, type ReadableErrorWithCode } from '@dereekb/util';

/**
 * Abstract base class for custom error widget components.
 *
 * Provides access to the injected {@link ReadableErrorWithCode} data, including the error code and message.
 * Extend this class when creating custom error widgets registered with {@link DbxErrorWidgetService}.
 *
 * @example
 * ```typescript
 * @Component({ template: `<p>Error: {{ message }}</p>` })
 * export class MyCustomErrorWidget extends AbstractDbxErrorWidgetComponent<MyErrorType> {
 *   // Access this.data, this.code, this.message
 * }
 * ```
 */
@Directive()
export abstract class AbstractDbxErrorWidgetComponent<T extends ReadableError = ReadableError> {
  readonly data = inject<ReadableErrorWithCode<T>>(DBX_INJECTION_COMPONENT_DATA);

  get code() {
    return this.data.code;
  }

  get message() {
    return this.data.message;
  }
}
