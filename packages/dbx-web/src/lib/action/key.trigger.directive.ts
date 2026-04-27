import { Directive, HostListener, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';

const DEFAULT_ACTION_KEY_TRIGGER = 'enter';

/**
 * Triggers the parent action context when a specific keyboard key is released.
 * Defaults to the "enter" key. Key names should be lowercase.
 *
 * @dbxWebComponent
 * @dbxWebSlug action-key-trigger
 * @dbxWebCategory action
 * @dbxWebRelated action-confirm, action-snackbar
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <div [dbxActionKeyTrigger]="'enter'"></div>
 * ```
 *
 * @example
 * ```html
 * <form [dbxAction]="saveAction" [dbxActionKeyTrigger]="'cmd+s'">...</form>
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
    if (event.key?.toLowerCase() === this.key()) {
      this.source.trigger();
    }
  }
}
