import { Directive, input } from '@angular/core';
import { type DbxHelpContextKey } from './help';
import { type ArrayOrValue, asArray } from '@dereekb/util';
import { map, type Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { registerHelpContextKeysWithDbxHelpContextService } from './help.context';

/**
 * Directive that registers one or more help context keys with the {@link DbxHelpContextService}. Automatically unregisters when the host element is destroyed.
 *
 * @example
 * ```html
 * <div [dbxHelpContext]="'my-feature-help'">
 *   <!-- Content with help context -->
 * </div>
 *
 * <div [dbxHelpContext]="['topic-a', 'topic-b']">
 *   <!-- Content with multiple help contexts -->
 * </div>
 * ```
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
