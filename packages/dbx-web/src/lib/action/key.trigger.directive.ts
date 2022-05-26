import { Directive, Host, HostListener, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';

const DEFAULT_ACTION_KEY_TRIGGER = 'enter';

/**
 * Directive that triggers the action on a specific key up event.
 *
 * Events/Keys to respond to should be lowercase.
 */
@Directive({
  selector: '[dbxActionKeyTrigger]'
})
export class DbxActionKeyTriggerDirective<T = unknown, O = unknown> {
  @Input('dbxActionKeyTrigger')
  inputKey: Maybe<string>;

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {}

  get key(): string {
    return this.inputKey || DEFAULT_ACTION_KEY_TRIGGER;
  }

  @HostListener('document:keyup', ['$event'])
  onKeyupHandler(event: KeyboardEvent): void {
    if (event.key && event.key.toLowerCase() === this.key) {
      this.source.trigger();
    }
  }
}
