import { Directive, input } from '@angular/core';
import { DbxHelpContextKey } from './help';
import { ArrayOrValue, asArray } from '@dereekb/util';
import { map, Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { registerHelpContextKeysWithDbxHelpContextService } from './help.context';

/**
 * Directive that registers one or more help contexts to the current context.
 */
@Directive({
  selector: '[dbxHelpContext]',
  standalone: true
})
export class DbxHelpContextDirective {
  /**
   * The input help context string(s) to add.
   */
  readonly dbxHelpContext = input.required<ArrayOrValue<DbxHelpContextKey>>();
  readonly helpContextKeys$: Observable<DbxHelpContextKey[]> = toObservable(this.dbxHelpContext).pipe(map(asArray));

  constructor() {
    registerHelpContextKeysWithDbxHelpContextService(this.helpContextKeys$);
  }
}
