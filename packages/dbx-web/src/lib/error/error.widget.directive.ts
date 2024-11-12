import { Directive, Inject, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { ReadableError, ReadableErrorWithCode } from '@dereekb/util';

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
