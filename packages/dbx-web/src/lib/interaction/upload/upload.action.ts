import { Type, Provider, forwardRef } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig } from './upload.accept';
import { DbxButtonWorking } from '@dereekb/dbx-core';

/**
 * Compatable interface for DbxUploadActionDirective.
 */
export abstract class DbxFileUploadActionCompatable {
  abstract setDisabled(disabled?: Maybe<boolean>): void;
  abstract setWorking(working?: Maybe<DbxButtonWorking>): void;
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
