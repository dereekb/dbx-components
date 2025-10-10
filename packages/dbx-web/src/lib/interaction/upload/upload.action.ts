import { Type, Provider, forwardRef } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig } from './upload.accept';

/**
 * Compatable interface for DbxUploadActionDirective.
 */
export abstract class DbxFileUploadActionCompatable {
  abstract setDisabled(disabled?: Maybe<boolean>): void;
  abstract setWorking(working?: Maybe<boolean>): void;
  abstract setMultiple(multiple?: Maybe<boolean>): void;
  abstract setAccept(accept?: Maybe<FileArrayAcceptMatchConfig['accept']>): void;
}

/**
 * Provides a DbxUploadActionCompatable for a given type.
 */
export function provideDbxFileUploadActionCompatable<S extends DbxFileUploadActionCompatable>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxFileUploadActionCompatable,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
