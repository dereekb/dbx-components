import { type Type, type Provider, forwardRef } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type FileArrayAcceptMatchConfig } from './upload.accept';
import { type DbxButtonWorking } from '@dereekb/dbx-core';

/**
 * Abstract interface for file upload components that can be controlled by the action system (disabled, working, multiple, accept states).
 */
export abstract class DbxFileUploadActionCompatable {
  abstract setDisabled(disabled?: Maybe<boolean>): void;
  abstract setWorking(working?: Maybe<DbxButtonWorking>): void;
  abstract setMultiple(multiple?: Maybe<boolean>): void;
  abstract setAccept(accept?: Maybe<FileArrayAcceptMatchConfig['accept']>): void;
}

/**
 * Provides a {@link DbxFileUploadActionCompatable} for dependency injection from the given component type.
 *
 * @example
 * ```ts
 * @Component({ providers: provideDbxFileUploadActionCompatable(MyUploadComponent) })
 * ```
 */
export function provideDbxFileUploadActionCompatable<S extends DbxFileUploadActionCompatable>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxFileUploadActionCompatable,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
