import { forwardRef, Provider, Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

export abstract class DbxPromptConfirm {
  abstract showDialog(): Observable<Maybe<boolean>>;
}

export function provideDbxPromptConfirm<S extends DbxPromptConfirm>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxPromptConfirm,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
