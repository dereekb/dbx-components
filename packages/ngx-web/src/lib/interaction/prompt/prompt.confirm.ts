import { Provider, Type } from '@angular/core';
import { Observable } from 'rxjs';

export abstract class DbNgxPromptConfirm {
  abstract showDialog(): Observable<boolean>;
}

export function ProvideDbNgxPromptConfirm<S>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbNgxPromptConfirm,
    useExisting: sourceType
  }];
}

