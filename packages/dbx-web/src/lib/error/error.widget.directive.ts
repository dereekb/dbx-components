import { Directive, Inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { ReadableError, ReadableErrorWithCode } from '@dereekb/util';

@Directive()
export abstract class AbstractDbxErrorWidgetComponent<T extends ReadableError = ReadableError> {
  get code() {
    return this.data.code;
  }

  get message() {
    return this.data.message;
  }

  constructor(@Inject(DBX_INJECTION_COMPONENT_DATA) readonly data: ReadableErrorWithCode<T>) {}
}
