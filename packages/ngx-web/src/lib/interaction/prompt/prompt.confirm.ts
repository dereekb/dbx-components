import { Provider, Type } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

export abstract class DbNgxPromptConfirm {
  abstract showDialog(): Observable<Maybe<boolean>>;
}

export function ProvideDbNgxPromptConfirm<S>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbNgxPromptConfirm,
    useExisting: sourceType
  }];
}

