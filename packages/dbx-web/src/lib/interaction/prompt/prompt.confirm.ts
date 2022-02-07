import { forwardRef, Provider, Type } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

export abstract class DbxPromptConfirm {
  abstract showDialog(): Observable<Maybe<boolean>>;
}

export function ProvideDbxPromptConfirm<S>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbxPromptConfirm,
    useExisting: forwardRef(() => sourceType)
  }];
}

