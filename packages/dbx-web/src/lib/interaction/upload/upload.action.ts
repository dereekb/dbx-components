import { type Type, type Provider, forwardRef } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type FileArrayAcceptMatchConfig } from './upload.accept';
import { DbxActionWorkable, provideDbxActionWorkable } from '@dereekb/dbx-core';

/**
 * Abstract interface for file upload components that can be controlled by the action system (disabled, working, multiple, accept states).
 *
 * Extends {@link DbxActionWorkable} (disabled/working), adding upload-specific multiple/accept controls.
 */
export abstract class DbxFileUploadActionCompatable extends DbxActionWorkable {
  abstract setMultiple(multiple?: Maybe<boolean>): void;
  abstract setAccept(accept?: Maybe<FileArrayAcceptMatchConfig['accept']>): void;
}

/**
 * Provides a {@link DbxFileUploadActionCompatable} for dependency injection from the given component type.
 *
 * @param sourceType - The concrete component class that implements {@link DbxFileUploadActionCompatable}
 * @returns The providers that register the given type as the {@link DbxFileUploadActionCompatable} implementation.
 *
 * @Component ({ providers: provideDbxFileUploadActionCompatable(MyUploadComponent) })
 * ```
 *
 * @example
 * ```ts
 */
export function provideDbxFileUploadActionCompatable<S extends DbxFileUploadActionCompatable>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxFileUploadActionCompatable,
      useExisting: forwardRef(() => sourceType)
    },
    ...provideDbxActionWorkable(sourceType)
  ];
}
