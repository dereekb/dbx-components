import { Directive, HostListener, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';

const DEFAULT_ACTION_KEY_TRIGGER = 'enter';

/**
 * Triggers the parent action context when a specific keyboard key is released.
 * Defaults to the "enter" key. Key names should be lowercase.
 *
 * @example
 * ```html
 * <form [dbxAction]="saveAction" dbxActionKeyTrigger>
 *   <!-- Pressing Enter triggers the action -->
 * </form>
 * ```
 *
 * @example
 * ```html
 * <div [dbxAction]="searchAction" [dbxActionKeyTrigger]="'escape'">
 *   <!-- Pressing Escape triggers the action -->
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxActionKeyTrigger]',
  standalone: true
})
export class DbxActionKeyTriggerDirective<T = unknown, O = unknown> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly key = input<string, Maybe<string>>(DEFAULT_ACTION_KEY_TRIGGER, { alias: 'dbxActionKeyTrigger', transform: (x) => (x ?? DEFAULT_ACTION_KEY_TRIGGER).toLowerCase() });

  @HostListener('document:keyup', ['$event'])
  onKeyupHandler(event: KeyboardEvent): void {
    if (event.key && event.key.toLowerCase() === this.key()) {
      this.source.trigger();
    }
  }
}
