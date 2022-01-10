import { Directive, Host, HostListener, Input, OnInit } from '@angular/core';
import { ActionContextStoreSourceInstance } from './action';
import { ActionContextStore } from './action.store';

const DEFAULT_ACTION_KEY_TRIGGER = 'enter';

/**
 * Directive that triggers the action on a specific key up event.
 *
 * Events/Keys to respond to should be lowercase.
 */
@Directive({
  selector: '[dbxActionKeyTrigger]',
})
export class DbNgxActionKeyTriggerDirective<T = any, O = any> {

  @Input('dbxActionKeyTrigger')
  inputKey: string;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) { }

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
